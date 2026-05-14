import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listChatsForUser, type ChatDoc } from '@/lib/db/chats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ chats: [] });
  }

  const chats = await listChatsForUser(userId);
  return NextResponse.json({ chats: chats.map(serializeChat) });
}

function serializeChat(chat: ChatDoc) {
  return {
    id: chat._id,
    updatedAt: chat.updatedAt.toISOString(),
    preview:
      chat.lastUserMessage ??
      chat.lastAssistantMessage ??
      'Nouvelle conversation',
  };
}
