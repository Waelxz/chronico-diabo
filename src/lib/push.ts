import 'server-only';
import webpush, { type PushSubscription } from 'web-push';
import { getEnv } from '@/lib/env';

export const VAPID_PUBLIC_KEY = getEnv().VAPID_PUBLIC_KEY;

let vapidReady = false;

export function initVapid(): boolean {
  if (vapidReady) return true;
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_MAILTO) {
    return false;
  }
  webpush.setVapidDetails(
    env.VAPID_MAILTO.startsWith('mailto:')
      ? env.VAPID_MAILTO
      : `mailto:${env.VAPID_MAILTO}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  vapidReady = true;
  return true;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string },
): Promise<void> {
  if (!initVapid()) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch {
    // Push endpoints expire frequently; failed sends must not break reminders.
  }
}
