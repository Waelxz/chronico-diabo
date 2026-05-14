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
import { getChatModel } from '@/lib/llm';
import { DIABO_PERSONA_FR } from '@/lib/diabo/persona';
import { appendMessage, touchChat } from '@/lib/db/chats';
import { searchKb, type KbChunkResult } from '@/lib/db/kb';
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
  "Si l'utilisateur demande des restaurants, appelle findRestaurants. Réponds ensuite en français avec les 3 meilleurs choix, leur score, le niveau de glucides et une phrase de prudence. Si la position est approximative, dis-le brièvement et propose de partager une localisation plus précise.";

type ChatRequestBody = { messages: UIMessage[] };

function extractText(message: UIMessage | undefined): string {
  if (!message) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim();
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

  // Resolve / mint chatId.
  const cookieStore = await cookies();
  const existingChatId = cookieStore.get(COOKIE_NAME)?.value;
  const chatId = existingChatId ?? new ObjectId().toHexString();
  const isNewChat = !existingChatId;

  // Persist the latest user turn (fire-and-forget).
  const latest = messages[messages.length - 1];
  const userText = latest?.role === 'user' ? extractText(latest) : '';
  void touchChat(chatId).catch((err) =>
    console.error('[chat] touchChat failed:', err),
  );
  if (userText) {
    void appendMessage(chatId, 'user', userText).catch((err) =>
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

  // Retrieval-augmented context (sprint 3). Best-effort: KB outage just
  // falls back to the persona-only prompt — chat never breaks on RAG failure.
  let retrievedChunks: KbChunkResult[] = [];
  if (userText) {
    try {
      retrievedChunks = await searchKb(userText, 3);
    } catch (err) {
      console.warn('[chat] searchKb failed, continuing without RAG:', err);
    }
  }
  const augmentedSystem =
    retrievedChunks.length > 0
      ? `${DIABO_PERSONA_FR}\n\n## Contexte issu de la base de connaissances Diabo\nUtilise ces éléments quand c'est pertinent, mais reste empathique et naturel — ne les cite pas comme des sources académiques.\n\n${retrievedChunks
          .map((c) => `### ${c.title}\n${c.content}`)
          .join('\n\n')}\n\n${RESTAURANT_TOOL_INSTRUCTIONS}`
      : `${DIABO_PERSONA_FR}\n\n${RESTAURANT_TOOL_INSTRUCTIONS}`;

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
        await appendMessage(chatId, 'assistant', trimmed, meta);
      } catch (err) {
        console.error('[chat] appendMessage(assistant) failed:', err);
      }
    },
    onError: ({ error }) => {
      console.error('[chat] streamText error:', error);
    },
  });

  const headers: Record<string, string> = {};
  if (isNewChat) {
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
