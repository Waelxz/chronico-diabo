import 'server-only';
import { CronExpressionParser } from 'cron-parser';
import {
  claimReminderDelivery,
  ensureReminderIndexes,
  getEnabledReminders,
  getPushSubscription,
  type Reminder,
} from '@/lib/db/reminders';
import { getEnv } from '@/lib/env';
import { sendPushNotification } from '@/lib/push';

export type ProcessRemindersResult = {
  checked: number;
  due: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function processDueReminders(
  now = new Date(),
): Promise<ProcessRemindersResult> {
  await ensureReminderIndexes().catch((err) =>
    console.warn('[reminders-cron] ensure indexes failed:', err),
  );

  const reminders = await getEnabledReminders();
  const scheduledAt = toMinuteStart(now);
  const result: ProcessRemindersResult = {
    checked: reminders.length,
    due: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  await Promise.all(
    reminders.map(async (reminder) => {
      if (!isReminderDue(reminder, scheduledAt)) return;
      result.due += 1;

      if (!reminder._id) {
        result.skipped += 1;
        return;
      }

      const claimed = await claimReminderDelivery(reminder._id, scheduledAt);
      if (!claimed) {
        result.skipped += 1;
        return;
      }

      const subscription = await getPushSubscription(reminder.userId);
      if (!subscription) {
        result.skipped += 1;
        return;
      }

      try {
        await sendPushNotification(subscription, {
          title: 'Rappel Diabo',
          body: reminder.label,
          url: '/reminders',
        });
        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        console.warn('[reminders-cron] push send failed:', err);
      }
    }),
  );

  return result;
}

export function isCronDueNow(cronExpr: string, now = new Date()): boolean {
  const scheduledAt = toMinuteStart(now);
  try {
    const expression = CronExpressionParser.parse(cronExpr, {
      tz: getEnv().REMINDER_TIMEZONE,
    });
    return expression.includesDate(scheduledAt);
  } catch (err) {
    console.warn('[reminders-cron] invalid cron expression:', cronExpr, err);
    return false;
  }
}

function isReminderDue(reminder: Reminder, scheduledAt: Date): boolean {
  if (reminder.lastSentAt && reminder.lastSentAt >= scheduledAt) return false;
  return isCronDueNow(reminder.cronExpr, scheduledAt);
}

function toMinuteStart(value: Date): Date {
  const output = new Date(value);
  output.setSeconds(0, 0);
  return output;
}
