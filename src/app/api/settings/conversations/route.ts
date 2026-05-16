import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteChatsForUser } from '@/lib/db/chats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  const deletedCount = await deleteChatsForUser(userId);
  return NextResponse.json({ deletedCount });
}
