import { cookies } from 'next/headers';
import { listMessages } from '@/lib/db/chats';

/**
 * GET /api/chats/current/messages
 *
 * Returns the message history of the *current* chat session, identified by
 * the `diabo_chat_id` httpOnly cookie. No cookie → empty list. The shape
 * matches what AI SDK's `useChat({ messages })` initial state expects, so
 * the client can hand it directly to `setMessages()`.
 *
 * Security: the cookie is the only proof of ownership for now (no accounts).
 * It is httpOnly + SameSite=Lax, so client JS can't steal it and cross-site
 * requests can't replay it. We'll layer real auth in sprint 6.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'diabo_chat_id';

type UIMessageLike = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  metadata?: Record<string, unknown>;
};

export async function GET() {
  const cookieStore = await cookies();
  const chatId = cookieStore.get(COOKIE_NAME)?.value;
  if (!chatId) {
    return Response.json({ chatId: null, messages: [] });
  }

  try {
    const docs = await listMessages(chatId, 200);
    const messages: UIMessageLike[] = docs.map((d) => {
      const msg: UIMessageLike = {
        id: d._id.toHexString(),
        role: d.role,
        parts: [{ type: 'text', text: d.content }],
      };
      if (d.metadata && Object.keys(d.metadata).length > 0) {
        msg.metadata = d.metadata;
      }
      return msg;
    });
    return Response.json({ chatId, messages });
  } catch (err) {
    console.error('[chats/current/messages] listMessages failed:', err);
    return Response.json({ chatId, messages: [] });
  }
}
