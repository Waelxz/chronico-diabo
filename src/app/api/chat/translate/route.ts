import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { listMessages, userOwnsChat } from '@/lib/db/chats';
import { getChatModel } from '@/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const translateSchema = z.object({
  chatId: z.string().trim().min(1),
  targetLanguage: z.enum(['ar', 'fr', 'en']),
});

const translatedResponseSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    }),
  ),
});

type UIMessageLike = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = translateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Demande de traduction invalide' },
      { status: 400 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  const { chatId, targetLanguage } = parsed.data;
  const ownsChat = await userOwnsChat(userId, chatId);
  if (!ownsChat) {
    return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });
  }

  const docs = await listMessages(chatId, 200);
  if (docs.length === 0) {
    return NextResponse.json({ chatId, messages: [] });
  }

  const sourceMessages = docs.map((doc) => ({
    id: doc._id.toHexString(),
    role: doc.role,
    text: doc.content,
    metadata: doc.metadata,
  }));

  const { text } = await generateText({
    model: getChatModel(),
    temperature: 0,
    system:
      'Tu es un traducteur médical prudent. Traduis uniquement le texte fourni, sans ajouter de conseil, diagnostic ou contenu nouveau. Réponds en JSON valide uniquement.',
    prompt: JSON.stringify({
      targetLanguage: languageLabel(targetLanguage),
      instructions:
        'Retourne exactement {"messages":[{"id":"...","text":"..."}]} avec les mêmes ids et les textes traduits.',
      messages: sourceMessages.map(({ id, role, text: messageText }) => ({
        id,
        role,
        text: messageText,
      })),
    }),
  });

  const translated = parseTranslatedMessages(text);
  if (!translated) {
    return NextResponse.json(
      { error: 'La traduction a retourné un format invalide' },
      { status: 502 },
    );
  }

  const translatedById = new Map(
    translated.messages.map((message) => [message.id, message.text]),
  );
  const messages: UIMessageLike[] = sourceMessages.map((message) => {
    const next: UIMessageLike = {
      id: `${message.id}-translated-${targetLanguage}`,
      role: message.role,
      parts: [
        {
          type: 'text',
          text: translatedById.get(message.id) ?? message.text,
        },
      ],
    };
    if (message.metadata && Object.keys(message.metadata).length > 0) {
      next.metadata = message.metadata;
    }
    return next;
  });

  return NextResponse.json({ chatId, targetLanguage, messages });
}

function parseTranslatedMessages(
  text: string,
): z.infer<typeof translatedResponseSchema> | null {
  try {
    const parsed = translatedResponseSchema.safeParse(
      JSON.parse(extractJsonObject(text)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function languageLabel(language: z.infer<typeof translateSchema>['targetLanguage']) {
  switch (language) {
    case 'ar':
      return 'arabe';
    case 'en':
      return 'anglais';
    case 'fr':
      return 'français';
  }
}
