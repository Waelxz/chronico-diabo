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
  const env = getEnv();
  const runStartedAt = Date.now();
  await ensureReminderIndexes().catch((err) =>
    console.warn('[reminders-cron] ensure indexes failed:', err),
  );

  const reminders = await getEnabledReminders();
  const scheduledAt = toMinuteStart(now);
  console.log('[reminders-cron] scheduler started', {
    checked: reminders.length,
    scheduledAt: scheduledAt.toISOString(),
    timezone: env.REMINDER_TIMEZONE,
    vapidPublicKeyConfigured: Boolean(env.VAPID_PUBLIC_KEY),
    vapidPrivateKeyConfigured: Boolean(env.VAPID_PRIVATE_KEY),
  });

  const result: ProcessRemindersResult = {
    checked: reminders.length,
    due: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  await Promise.all(
    reminders.map(async (reminder) => {
      const reminderLog = getReminderLogContext(reminder);
      if (!isReminderDue(reminder, scheduledAt)) {
        console.log('[reminders-cron] reminder not due', reminderLog);
        return;
      }

      result.due += 1;
      console.log('[reminders-cron] reminder due', {
        ...reminderLog,
        scheduledAt: scheduledAt.toISOString(),
      });

      if (!reminder._id) {
        result.skipped += 1;
        console.warn('[reminders-cron] reminder skipped: missing _id', reminderLog);
        return;
      }

      const subscription = await getPushSubscription(reminder.userId);
      if (!subscription) {
        result.skipped += 1;
        console.warn('[reminders-cron] reminder skipped: no push subscription', {
          ...reminderLog,
          userId: reminder.userId,
        });
        return;
      }

      const claimed = await claimReminderDelivery(reminder._id, scheduledAt);
      if (!claimed) {
        result.skipped += 1;
        console.log('[reminders-cron] reminder skipped: already claimed', {
          ...reminderLog,
          scheduledAt: scheduledAt.toISOString(),
        });
        return;
      }

      try {
        await sendPushNotification(subscription, {
          title: 'Rappel Diabo',
          body: reminder.label,
          url: '/reminders',
        });
        result.sent += 1;
        console.log('[reminders-cron] push notification sent', {
          ...reminderLog,
          scheduledAt: scheduledAt.toISOString(),
        });
      } catch (err) {
        result.failed += 1;
        console.warn('[reminders-cron] push send failed:', {
          ...reminderLog,
          error: formatErrorForLog(err),
        });
      }
    }),
  );

  console.log('[reminders-cron] scheduler completed', {
    durationMs: Date.now() - runStartedAt,
    ...result,
  });
  return result;
}

export function isCronDueNow(cronExpr: string, now = new Date()): boolean {
  const scheduledAt = toMinuteStart(now);
  try {
    const expression = CronExpressionParser.parse(cronExpr, {
      tz: getEnv().REMINDER_TIMEZONE,
    });
    const due = expression.includesDate(scheduledAt);
    console.log('[reminders-cron] cron evaluated', {
      cronExpr,
      scheduledAt: scheduledAt.toISOString(),
      due,
    });
    return due;
  } catch (err) {
    console.warn('[reminders-cron] invalid cron expression:', {
      cronExpr,
      scheduledAt: scheduledAt.toISOString(),
      error: formatErrorForLog(err),
    });
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

function getReminderLogContext(reminder: Reminder) {
  return {
    reminderId: reminder._id?.toHexString() ?? null,
    userId: reminder.userId,
    type: reminder.type,
    cronExpr: reminder.cronExpr,
    lastSentAt: reminder.lastSentAt?.toISOString() ?? null,
  };
}

function formatErrorForLog(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
