import 'server-only';
import type { PushSubscription } from 'web-push';
import {
  configureVapid,
  sendNotification,
  VAPID_PUBLIC_KEY,
} from '@/lib/notifications/push';

export { VAPID_PUBLIC_KEY };
export const initVapid = configureVapid;

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  try {
    await sendNotification(subscription, payload);
  } catch {
    // Push endpoints expire frequently; failed sends must not break reminders.
  }
}
