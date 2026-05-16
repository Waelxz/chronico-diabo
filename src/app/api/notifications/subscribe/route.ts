import { NextResponse } from 'next/server';
import type { PushSubscription } from 'web-push';
import { auth } from '@/lib/auth';
import {
  subscribeUser,
  VAPID_PUBLIC_KEY,
} from '@/lib/notifications/push';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY ?? null });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
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

  await subscribeUser(userId, subscription).catch((err) => {
    console.error('[notifications-subscribe] save failed:', err);
    throw err;
  });

  return NextResponse.json({ ok: true });
}

function readSubscription(value: unknown): PushSubscription | null {
  const subscription =
    value && typeof value === 'object' && 'subscription' in value
      ? (value as { subscription?: unknown }).subscription
      : value;

  if (
    !subscription ||
    typeof subscription !== 'object' ||
    typeof (subscription as { endpoint?: unknown }).endpoint !== 'string'
  ) {
    return null;
  }

  return subscription as PushSubscription;
}
