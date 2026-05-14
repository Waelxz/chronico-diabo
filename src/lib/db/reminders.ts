import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import type { PushSubscription } from 'web-push';
import { getDb } from '@/lib/mongodb';

export type ReminderType =
  | 'medication'
  | 'glucose'
  | 'exercise'
  | 'hydration'
  | 'custom';

export type Reminder = {
  _id?: ObjectId;
  userId: string;
  label: string;
  cronExpr: string;
  type: ReminderType;
  enabled: boolean;
  pushSubscription?: string;
  createdAt: Date;
};

export type ReminderInput = Omit<Reminder, '_id' | 'userId' | 'createdAt'> & {
  _id?: string;
};

type PushSubscriptionDoc = {
  _id?: ObjectId;
  userId: string;
  subscription: string;
  updatedAt: Date;
};

let reminderIndexesPromise: Promise<void> | null = null;

async function remindersCol(): Promise<Collection<Reminder> | null> {
  const db = await getDb();
  return db ? db.collection<Reminder>('reminders') : null;
}

async function pushSubscriptionsCol(): Promise<
  Collection<PushSubscriptionDoc> | null
> {
  const db = await getDb();
  return db ? db.collection<PushSubscriptionDoc>('push_subscriptions') : null;
}

export async function ensureReminderIndexes(): Promise<void> {
  if (reminderIndexesPromise) return reminderIndexesPromise;
  const [reminders, subscriptions] = await Promise.all([
    remindersCol(),
    pushSubscriptionsCol(),
  ]);
  reminderIndexesPromise = Promise.all([
    reminders?.createIndex({ userId: 1 }, { name: 'userId' }),
    subscriptions?.createIndex(
      { userId: 1 },
      { name: 'userId_unique', unique: true },
    ),
  ]).then(() => undefined);
  return reminderIndexesPromise;
}

export async function getReminders(userId: string): Promise<Reminder[]> {
  const col = await remindersCol();
  if (!col) return [];
  return col.find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function upsertReminder(
  userId: string,
  reminder: ReminderInput,
): Promise<Reminder | null> {
  const col = await remindersCol();
  if (!col) return null;
  const now = new Date();
  const doc = {
    userId,
    label: reminder.label,
    cronExpr: reminder.cronExpr,
    type: reminder.type,
    enabled: reminder.enabled,
    ...(reminder.pushSubscription
      ? { pushSubscription: reminder.pushSubscription }
      : {}),
  };

  if (reminder._id && ObjectId.isValid(reminder._id)) {
    const _id = new ObjectId(reminder._id);
    await col.updateOne(
      { _id, userId },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    return col.findOne({ _id, userId });
  }

  const inserted: Reminder = {
    _id: new ObjectId(),
    ...doc,
    createdAt: now,
  };
  await col.insertOne(inserted);
  return inserted;
}

export async function updateReminderEnabled(
  userId: string,
  id: string,
  enabled: boolean,
): Promise<Reminder | null> {
  const col = await remindersCol();
  if (!col || !ObjectId.isValid(id)) return null;
  const _id = new ObjectId(id);
  await col.updateOne({ _id, userId }, { $set: { enabled } });
  return col.findOne({ _id, userId });
}

export async function deleteReminder(
  userId: string,
  id: string,
): Promise<boolean> {
  const col = await remindersCol();
  if (!col || !ObjectId.isValid(id)) return false;
  const result = await col.deleteOne({ _id: new ObjectId(id), userId });
  return result.deletedCount === 1;
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription,
): Promise<void> {
  const [reminders, subscriptions] = await Promise.all([
    remindersCol(),
    pushSubscriptionsCol(),
  ]);
  const serialized = JSON.stringify(subscription);
  const updatedAt = new Date();
  await Promise.all([
    subscriptions?.updateOne(
      { userId },
      { $set: { subscription: serialized, updatedAt }, $setOnInsert: { userId } },
      { upsert: true },
    ),
    reminders?.updateMany({ userId }, { $set: { pushSubscription: serialized } }),
  ]);
}

export async function getPushSubscription(
  userId: string,
): Promise<PushSubscription | null> {
  const col = await pushSubscriptionsCol();
  if (!col) return null;
  const doc = await col.findOne({ userId });
  if (!doc?.subscription) return null;
  try {
    return JSON.parse(doc.subscription) as PushSubscription;
  } catch {
    return null;
  }
}
