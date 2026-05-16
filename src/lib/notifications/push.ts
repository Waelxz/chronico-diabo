import 'server-only';
import webpush, { type PushSubscription } from 'web-push';
import { ensureReminderIndexes, savePushSubscription } from '@/lib/db/reminders';
import { getEnv } from '@/lib/env';

export const VAPID_PUBLIC_KEY = getEnv().VAPID_PUBLIC_KEY;

let vapidConfigured = false;

export function configureVapid(): boolean {
  if (vapidConfigured) return true;

  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return false;
  }

  const subject = env.VAPID_MAILTO
    ? env.VAPID_MAILTO.startsWith('mailto:')
      ? env.VAPID_MAILTO
      : `mailto:${env.VAPID_MAILTO}`
    : env.APP_URL;
  webpush.setVapidDetails(subject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

export async function subscribeUser(
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  await ensureReminderIndexes();
  await savePushSubscription(userId, subscription);
}

export async function sendNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!configureVapid()) {
    throw new Error('VAPID keys are not configured');
  }
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
