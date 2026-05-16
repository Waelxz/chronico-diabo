import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteLog, type OwnerKey } from '@/lib/db/glucose';

export const runtime = 'nodejs';

const COOKIE_NAME = 'diabo_chat_id';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  const cookieStore = userId ? null : await cookies();
  const sessionId = cookieStore?.get(COOKIE_NAME)?.value;
  const { id } = await context.params;

  if (!userId && !sessionId) {
    return NextResponse.json({ ok: true });
  }

  const ownerKey: OwnerKey = userId
    ? { userId }
    : { sessionId: sessionId as string };
  await deleteLog(ownerKey, id);
  return NextResponse.json({ ok: true });
}
