import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getChatModel } from '@/lib/llm';
import { getDb } from '@/lib/mongodb';
import { DIABO_PERSONA_FR } from '@/lib/diabo/persona';
import { appendMessage, touchChat, userOwnsChat } from '@/lib/db/chats';
import { getProfile, type CompanionProfile } from '@/lib/db/companion';
import { searchKb, type KbChunkResult } from '@/lib/db/kb';
import { findHotelsForChat } from '@/lib/hotels/tool';
import { findRestaurantsForChat } from '@/lib/restaurants/tool';
import type {
  DiaboMessageMetadata,
  KbCitation,
} from '@/lib/diabo/citations';

/**
 * Diabo chat endpoint.
 *
 * - Streams an LLM reply back to the AI SDK `useChat` hook.
 * - Identifies the conversation via the `diabo_chat_id` httpOnly cookie,
 *   minted on the first call.
 * - Persists user + assistant messages to MongoDB Atlas, but **never blocks
 *   the stream on a DB write** — Mongo outage must not stop chat.
 */

// MongoDB driver requires Node.js, not the Edge runtime.
export const runtime = 'nodejs';
// Free-tier OpenRouter models can take a few seconds; give them headroom.
export const maxDuration = 60;

const COOKIE_NAME = 'diabo_chat_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const RESTAURANT_TOOL_INSTRUCTIONS =
  "Si l'utilisateur demande des restaurants, appelle findRestaurants. Réponds ensuite en français avec les 3 meilleurs choix, leur score, le niveau de glucides et une phrase de prudence. Si la position est approximative, dis-le brièvement et propose de partager une localisation plus précise. Si l'utilisateur demande des hôtels ou hébergements, appelle findHotels.";

type ChatRequestBody = {
  messages: UIMessage[];
  chatId?: string | null;
  userId?: string;
};

const onboardingProfileSchema = z.object({
  diabetesType: z.enum(['t1', 't2', 'pre', 'unknown']).optional(),
  goal: z.enum(['glucose', 'restaurants', 'travel', 'emotional']).optional(),
  name: z.string().trim().max(80).optional(),
  birthDate: z.string().trim().max(10).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(20).max(350).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(40).optional(),
});

type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;

function extractText(message: UIMessage | undefined): string {
  if (!message) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim();
}

function detectEmergencyIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    'perte de conscience',
    'convulsion',
    'douleur thoracique',
    'du mal a respirer',
    'acidocetose',
    'coma',
    'malaise severe',
    'urgence medicale',
    'appeler le 15',
    'appeler le 190',
  ].some((keyword) => normalized.includes(keyword));
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages must be a non-empty array', { status: 400 });
  }

  // Resolve / mint chatId. Signed-in users can choose a stored conversation;
  // anonymous users keep the original rolling cookie thread.
  const session = await auth();
  const userId = session?.user?.id;
  if (body.userId && body.userId !== userId) {
    return new Response('Utilisateur invalide', { status: 403 });
  }
  const cookieStore = await cookies();
  const existingChatId = cookieStore.get(COOKIE_NAME)?.value;
  const anonId = req.headers.get('x-anon-id') ?? existingChatId ?? null;
  let chatId = existingChatId ?? new ObjectId().toHexString();
  let isNewChat = !existingChatId;

  if (userId) {
    if (body.chatId) {
      const ownsChat = await userOwnsChat(userId, body.chatId);
      if (!ownsChat) {
        return new Response('Conversation introuvable', { status: 404 });
      }
      chatId = body.chatId;
      isNewChat = false;
    } else {
      chatId = new ObjectId().toHexString();
      isNewChat = false;
    }
  }

  // Persist the latest user turn (fire-and-forget).
  const latest = messages[messages.length - 1];
  const userText = latest?.role === 'user' ? extractText(latest) : '';
  const emergencyIntent = detectEmergencyIntent(userText);
  void touchChat(chatId, userId).catch((err) =>
    console.error('[chat] touchChat failed:', err),
  );
  if (userText) {
    void appendMessage(chatId, 'user', userText, undefined, {
      userId,
      anonId,
    }).catch((err) =>
      console.error('[chat] appendMessage(user) failed:', err),
    );
  }

  // Hand the conversation to the LLM.
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    modelMessages = await convertToModelMessages(messages);
  } catch (err) {
    console.error('[chat] convertToModelMessages failed:', err);
    return new Response('Failed to parse messages', { status: 400 });
  }

  // Parallelise all pre-LLM async work so they don't block each other.
  // RAG is skipped for very short / greeting messages to save embedding latency.
  const shouldRag = userText.length >= 10;
  const [retrievedChunksRaw, onboardingProfile, profile] = await Promise.all([
    shouldRag
      ? searchKb(userText, 2).catch((err) => {
          console.warn('[chat] searchKb failed, continuing without RAG:', err);
          return [] as KbChunkResult[];
        })
      : Promise.resolve([] as KbChunkResult[]),
    getOnboardingProfile(req, userId, anonId).catch((err) => {
      console.warn('[chat] getOnboardingProfile failed, continuing:', err);
      return null;
    }),
    getProfile(chatId).catch((err) => {
      console.warn('[chat] getProfile failed, continuing without memory:', err);
      return null;
    }),
  ]);

  // Only inject KB chunks that are actually relevant (score ≥ 0.65).
  const retrievedChunks = retrievedChunksRaw.filter((c) => c.score >= 0.65);

  let augmentedSystem =
    retrievedChunks.length > 0
      ? `${DIABO_PERSONA_FR}\n\n## Contexte issu de la base de connaissances Diabo\nUtilise ces éléments quand c'est pertinent, mais reste empathique et naturel — ne les cite pas comme des sources académiques.\n\n${retrievedChunks
          .map((c) => `### ${c.title}\n${c.content}`)
          .join('\n\n')}\n\n${RESTAURANT_TOOL_INSTRUCTIONS}`
      : `${DIABO_PERSONA_FR}\n\n${RESTAURANT_TOOL_INSTRUCTIONS}`;

  const onboardingBlock = buildOnboardingProfileBlock(onboardingProfile);
  if (onboardingBlock) {
    augmentedSystem = `${augmentedSystem}\n\n${onboardingBlock}`;
  }

  if (profile) {
    const memoryBlock = buildMemoryBlock(profile);
    if (memoryBlock) {
      augmentedSystem = `${memoryBlock}\n\n${augmentedSystem}`;
    }
  }

  if (emergencyIntent) {
    augmentedSystem = `## SAFETY_OVERRIDE\nCommence ta reponse par une escalation d'urgence claire en francais: recommande d'appeler les urgences locales ou un medecin immediatement. Dis que Diabo ne remplace pas un avis medical. Reste bref.\n\n${augmentedSystem}`;
  }

  // Surface KB chunks as message-level citations: streamed to the client
  // for the chips UI, AND persisted with the assistant message so a refresh
  // keeps them. We drop the full content here — only topic/title/score.
  const citations: KbCitation[] = retrievedChunks.map((c) => ({
    topic: c.topic,
    title: c.title,
    score: Math.round((c.score ?? 0) * 1000) / 1000,
  }));

  const result = streamText({
    model: getChatModel(),
    system: augmentedSystem,
    messages: modelMessages,
    tools: {
      findRestaurants: tool({
        description:
          'Trouve des restaurants proches et évalue leur compatibilité probable avec une alimentation diabétique.',
        inputSchema: z.object({
          near: z
            .string()
            .describe(
              'Zone demandée par l’utilisateur, par exemple "Tunis", "La Marsa" ou "36.8065,10.1815".',
            ),
          dietPrefs: z
            .array(z.string())
            .optional()
            .describe('Préférences éventuelles: grillade, poisson, salade, etc.'),
        }),
        execute: findRestaurantsForChat,
      }),
      findHotels: tool({
        description:
          'Trouve des hôtels proches adaptés aux voyageurs diabétiques (accès fauteuil, étoiles, proximité soins).',
        inputSchema: z.object({
          near: z
            .string()
            .describe(
              'Zone demandée, ex: Tunis, Sousse ou coordonnées 36.8,10.1',
            ),
        }),
        execute: findHotelsForChat,
      }),
    },
    stopWhen: stepCountIs(3),
    temperature: 0.75,
    onFinish: async ({ text }) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      // MUST be awaited: AI SDK awaits onFinish before completing the stream,
      // which keeps the Vercel function alive long enough for the second
      // updateOne inside appendMessage (the cached `lastAssistantMessage`
      // field on the chat doc). Fire-and-forget here gets the function
      // killed mid-write on serverless.
      try {
        const meta =
          citations.length > 0 ? { kbCitations: citations } : undefined;
        await appendMessage(chatId, 'assistant', trimmed, meta, {
          userId,
          anonId,
        });
      } catch (err) {
        console.error('[chat] appendMessage(assistant) failed:', err);
      }
    },
    onError: ({ error }) => {
      console.error('[chat] streamText error:', error);
    },
  });

  const headers: Record<string, string> = {};
  headers['x-diabo-chat-id'] = chatId;
  if (!userId && isNewChat) {
    headers['Set-Cookie'] =
      `${COOKIE_NAME}=${chatId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  }

  return result.toUIMessageStreamResponse({
    headers,
    // Attach citations to the assistant message metadata on stream start.
    // The client reads `message.metadata.kbCitations` to render chips.
    messageMetadata: ({ part }): DiaboMessageMetadata | undefined => {
      if (part.type === 'start' && citations.length > 0) {
        return { kbCitations: citations };
      }
      return undefined;
    },
  });
}

function buildMemoryBlock(profile: CompanionProfile): string {
  const parts: string[] = [];
  if (profile.name) parts.push(`Prénom: ${profile.name}.`);
  if (profile.birthDate) parts.push(`Date de naissance: ${profile.birthDate}.`);
  if (profile.gender) parts.push(`Genre: ${genderLabel(profile.gender)}.`);
  if (profile.heightCm) parts.push(`Taille: ${profile.heightCm} cm.`);
  if (profile.weightKg) parts.push(`Poids: ${profile.weightKg} kg.`);
  if (profile.emergencyContactName) {
    parts.push(`Contact d'urgence: ${profile.emergencyContactName}.`);
  }
  if (profile.emergencyContactPhone) {
    parts.push(`Téléphone d'urgence: ${profile.emergencyContactPhone}.`);
  }
  if (profile.diabetesType) {
    parts.push(`Diabète: ${diabetesTypeLabel(profile.diabetesType)}.`);
  }
  if (profile.treatment) parts.push(`Traitement: ${profile.treatment}.`);
  if (profile.goals?.length) parts.push(`Objectifs: ${profile.goals.join(', ')}.`);
  if (profile.restrictions?.length) {
    parts.push(`Restrictions: ${profile.restrictions.join(', ')}.`);
  }
  if (profile.city) parts.push(`Ville: ${profile.city}.`);
  return parts.length > 0 ? `## Mémoire utilisateur\n${parts.join(' ')}` : '';
}

function genderLabel(type: CompanionProfile['gender']): string {
  switch (type) {
    case 'male':
      return 'homme';
    case 'female':
      return 'femme';
    case 'other':
      return 'autre';
    default:
      return 'non précisé';
  }
}

function diabetesTypeLabel(type: CompanionProfile['diabetesType']): string {
  switch (type) {
    case '1':
      return 'type 1';
    case '2':
      return 'type 2';
    case 'gestational':
      return 'gestationnel';
    case 'prediabetes':
      return 'prédiabète';
    case 'other':
      return 'autre';
    default:
      return 'non précisé';
  }
}

async function getOnboardingProfile(
  req: Request,
  userId: string | undefined,
  anonId: string | null,
): Promise<OnboardingProfile | null> {
  const headerProfile = parseOnboardingProfileHeader(
    req.headers.get('x-diabo-profile'),
  );
  if (headerProfile) return headerProfile;

  const db = await getDb();
  if (!db) return null;

  const filter = userId ? { userId } : anonId ? { anonId } : null;
  if (!filter) return null;

  const doc = await db.collection('users').findOne(filter);
  const parsed = onboardingProfileSchema.safeParse({
    diabetesType: doc?.diabetesType,
    goal: doc?.goal,
    name: doc?.name,
    birthDate: doc?.birthDate,
    gender: doc?.gender,
    heightCm: doc?.heightCm,
    weightKg: doc?.weightKg,
    emergencyContactName: doc?.emergencyContactName,
    emergencyContactPhone: doc?.emergencyContactPhone,
  });
  return parsed.success ? parsed.data : null;
}

function parseOnboardingProfileHeader(
  value: string | null,
): OnboardingProfile | null {
  if (!value) return null;
  try {
    const parsed = onboardingProfileSchema.safeParse(JSON.parse(value));
    return parsed.success ? sanitizeOnboardingProfile(parsed.data) : null;
  } catch {
    return null;
  }
}

function sanitizePromptString(value: string): string {
  return value.slice(0, 100).replace(/[<>{}|\\]/g, '');
}

function sanitizeOnboardingProfile(profile: OnboardingProfile): OnboardingProfile {
  return {
    diabetesType: profile.diabetesType
      ? (sanitizePromptString(profile.diabetesType) as OnboardingProfile['diabetesType'])
      : undefined,
    goal: profile.goal
      ? (sanitizePromptString(profile.goal) as OnboardingProfile['goal'])
      : undefined,
    name: profile.name ? sanitizePromptString(profile.name) : undefined,
    birthDate: profile.birthDate
      ? sanitizePromptString(profile.birthDate)
      : undefined,
    gender: profile.gender
      ? (sanitizePromptString(profile.gender) as OnboardingProfile['gender'])
      : undefined,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    emergencyContactName: profile.emergencyContactName
      ? sanitizePromptString(profile.emergencyContactName)
      : undefined,
    emergencyContactPhone: profile.emergencyContactPhone
      ? sanitizePromptString(profile.emergencyContactPhone)
      : undefined,
  };
}

function buildOnboardingProfileBlock(profile: OnboardingProfile | null): string {
  if (!profile) return '';
  const safeProfile = sanitizeOnboardingProfile(profile);
  const lines: string[] = [];
  if (safeProfile.name) lines.push(`L'utilisateur s'appelle ${safeProfile.name}.`);
  if (safeProfile.birthDate) {
    lines.push(`Sa date de naissance est ${safeProfile.birthDate}.`);
  }
  if (safeProfile.gender) {
    lines.push(`Genre: ${genderLabel(safeProfile.gender)}.`);
  }
  if (safeProfile.heightCm) lines.push(`Taille: ${safeProfile.heightCm} cm.`);
  if (safeProfile.weightKg) lines.push(`Poids: ${safeProfile.weightKg} kg.`);
  if (safeProfile.emergencyContactName) {
    lines.push(`Contact d'urgence: ${safeProfile.emergencyContactName}.`);
  }
  if (safeProfile.diabetesType === 't1') {
    lines.push('Il vit avec un diabète de type 1.');
  }
  if (safeProfile.diabetesType === 't2') {
    lines.push('Il vit avec un diabète de type 2.');
  }
  if (safeProfile.diabetesType === 'pre') {
    lines.push('Il est en situation de pré-diabète.');
  }
  if (safeProfile.goal === 'emotional') {
    lines.push(
      "Son objectif principal est le soutien émotionnel. Priorise l'empathie.",
    );
  }
  if (safeProfile.goal === 'glucose') {
    lines.push(
      'Son objectif principal est la gestion de la glycémie. Priorise les conseils pratiques.',
    );
  }
  return lines.length > 0 ? lines.join('\n') : '';
}
