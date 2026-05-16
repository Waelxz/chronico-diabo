import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { processDueReminders } from '@/lib/reminders/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const result = await processDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

function isAuthorizedCronRequest(req: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return getEnv().NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
