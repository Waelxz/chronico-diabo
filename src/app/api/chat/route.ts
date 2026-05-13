import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { getChatModel } from '@/lib/llm';
import { DIABO_PERSONA_FR } from '@/lib/diabo/persona';
import { appendMessage, touchChat } from '@/lib/db/chats';

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

  const result = streamText({
    model: getChatModel(),
    system: DIABO_PERSONA_FR,
    messages: modelMessages,
    temperature: 0.75,
    onFinish: ({ text }) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      void appendMessage(chatId, 'assistant', trimmed).catch((err) =>
        console.error('[chat] appendMessage(assistant) failed:', err),
      );
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
  });
}
