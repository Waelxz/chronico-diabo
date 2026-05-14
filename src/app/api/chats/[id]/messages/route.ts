import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listMessages, userOwnsChat } from '@/lib/db/chats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UIMessageLike = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  metadata?: Record<string, unknown>;
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  const { id } = await context.params;
  const ownsChat = await userOwnsChat(userId, id);
  if (!ownsChat) {
    return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });
  }

  const docs = await listMessages(id, 200);
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
  return NextResponse.json({ chatId: id, messages });
}
