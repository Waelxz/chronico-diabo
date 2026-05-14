import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteLog } from '@/lib/db/glucose';

export const runtime = 'nodejs';

const COOKIE_NAME = 'diabo_chat_id';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  const { id } = await context.params;

  if (sessionId) {
    await deleteLog(sessionId, id);
  }

  return NextResponse.json({ ok: true });
}
