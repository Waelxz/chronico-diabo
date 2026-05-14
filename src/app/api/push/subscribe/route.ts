import { NextResponse } from 'next/server';
import type { PushSubscription } from 'web-push';
import { auth } from '@/lib/auth';
import { ensureReminderIndexes, savePushSubscription } from '@/lib/db/reminders';
import { VAPID_PUBLIC_KEY } from '@/lib/push';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY ?? null });
}

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

  const subscription = readSubscription(rawBody);
  if (!subscription) {
    return NextResponse.json(
      { error: 'Abonnement notifications invalide' },
      { status: 400 },
    );
  }

  await ensureReminderIndexes().catch((err) =>
    console.warn('[push-subscribe] ensure indexes failed:', err),
  );
  await savePushSubscription(userId, subscription);
  return NextResponse.json({ ok: true });
}

function readSubscription(value: unknown): PushSubscription | null {
  if (!value || typeof value !== 'object' || !('subscription' in value)) {
    return null;
  }
  const subscription = (value as { subscription?: unknown }).subscription;
  if (
    !subscription ||
    typeof subscription !== 'object' ||
    typeof (subscription as { endpoint?: unknown }).endpoint !== 'string'
  ) {
    return null;
  }
  return subscription as PushSubscription;
}
