import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listChatsForUser, listMessages } from '@/lib/db/chats';
import { getReminders } from '@/lib/db/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  const [chats, reminders] = await Promise.all([
    listChatsForUser(userId, 500),
    getReminders(userId),
  ]);
  const messagesByChat = await Promise.all(
    chats.map(async (chat) => ({
      chatId: chat._id,
      messages: await listMessages(chat._id, 500),
    })),
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: userId,
      email: session.user?.email ?? null,
      name: session.user?.name ?? null,
    },
    chats,
    messagesByChat,
    reminders,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="diabo-data.json"',
    },
  });
}
