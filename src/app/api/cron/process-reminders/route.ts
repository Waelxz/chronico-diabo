import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { processDueReminders } from '@/lib/reminders/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const startedAt = Date.now();
  const env = getEnv();
  console.log('[reminders-cron] endpoint called', {
    cronSecretConfigured: Boolean(env.CRON_SECRET),
    vapidPublicKeyConfigured: Boolean(env.VAPID_PUBLIC_KEY),
    vapidPrivateKeyConfigured: Boolean(env.VAPID_PRIVATE_KEY),
    reminderTimezone: env.REMINDER_TIMEZONE,
  });

  if (!isAuthorizedCronRequest(req)) {
    console.warn('[reminders-cron] unauthorized cron request', {
      cronSecretConfigured: Boolean(env.CRON_SECRET),
      nodeEnv: env.NODE_ENV,
    });
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const result = await processDueReminders();
    console.log('[reminders-cron] endpoint completed', {
      durationMs: Date.now() - startedAt,
      ...result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[reminders-cron] endpoint failed:', err);
    return NextResponse.json(
      { error: 'Traitement des rappels impossible' },
      { status: 500 },
    );
  }
}

function isAuthorizedCronRequest(req: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return getEnv().NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
