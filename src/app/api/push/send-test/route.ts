import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  ensureReminderIndexes,
  getPushSubscription,
} from '@/lib/db/reminders';
import { sendPushNotification } from '@/lib/push';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Route de test désactivée' }, { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  await ensureReminderIndexes().catch((err) =>
    console.warn('[push-test] ensure indexes failed:', err),
  );
  const subscription = await getPushSubscription(userId);
  if (subscription) {
    await sendPushNotification(subscription, {
      title: 'Diabo',
      body: 'Notification de test activée.',
    });
  }
  return NextResponse.json({ ok: true });
}
