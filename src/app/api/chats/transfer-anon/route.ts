import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { transferAnonChatToUser } from '@/lib/db/chats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const transferSchema = z.object({
  anonId: z.string().trim().min(8).max(120),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = transferSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Conversation invalide' }, { status: 400 });
  }

  const chatId = await transferAnonChatToUser(parsed.data.anonId, userId);
  return NextResponse.json({ chatId });
}
