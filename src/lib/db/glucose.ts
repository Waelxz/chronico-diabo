import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type GlucoseContext =
  | 'fasting'
  | 'before_meal'
  | 'after_meal'
  | 'bedtime'
  | 'other';

export type GlucoseLog = {
  _id?: ObjectId;
  sessionId?: string;
  userId?: string;
  value: number;
  unit: GlucoseUnit;
  measuredAt: Date;
  context: GlucoseContext;
  note?: string;
};

export type NewGlucoseLog = Omit<GlucoseLog, '_id' | 'sessionId' | 'userId'>;

export type OwnerKey =
  | { sessionId: string; userId?: never }
  | { userId: string; sessionId?: never };

let glucoseIndexesPromise: Promise<void> | null = null;

async function glucoseCol(): Promise<Collection<GlucoseLog> | null> {
  const db = await getDb();
  return db ? db.collection<GlucoseLog>('glucose_logs') : null;
}

export async function ensureGlucoseIndexes(): Promise<void> {
  if (glucoseIndexesPromise) return glucoseIndexesPromise;
  const col = await glucoseCol();
  if (!col) return;
  glucoseIndexesPromise = Promise.all([
    col.createIndex(
      { sessionId: 1, measuredAt: -1 },
      { name: 'session_measuredAt_desc' },
    ),
    col.createIndex(
      { userId: 1, measuredAt: -1 },
      { name: 'userId_measuredAt_desc', sparse: true },
    ),
  ]).then(() => undefined);
  return glucoseIndexesPromise;
}

export async function insertLog(
  key: OwnerKey,
  log: NewGlucoseLog,
): Promise<GlucoseLog | null> {
  const col = await glucoseCol();
  if (!col) return null;
  const doc: GlucoseLog = {
    _id: new ObjectId(),
    ...ownerFilter(key),
    ...log,
  };
  await col.insertOne(doc);
  return doc;
}

export async function getLogsForOwner(
  key: OwnerKey,
  limitDays = 30,
): Promise<GlucoseLog[]> {
  const col = await glucoseCol();
  if (!col) return [];
  const since = new Date();
  since.setDate(since.getDate() - limitDays);
  return col
    .find({
      ...ownerFilter(key),
      measuredAt: { $gte: since },
    })
    .sort({ measuredAt: -1 })
    .toArray();
}

export async function deleteLog(
  key: OwnerKey,
  logId: string,
): Promise<boolean> {
  const col = await glucoseCol();
  if (!col || !ObjectId.isValid(logId)) return false;
  const result = await col.deleteOne({
    _id: new ObjectId(logId),
    ...ownerFilter(key),
  });
  return result.deletedCount === 1;
}

export async function transferAnonLogsToUser(
  sessionId: string,
  userId: string,
): Promise<void> {
  const col = await glucoseCol();
  if (!col) return;
  await col.updateMany({ sessionId }, { $set: { userId } });
}

function ownerFilter(key: OwnerKey): OwnerKey {
  return key.userId !== undefined
    ? { userId: key.userId }
    : { sessionId: key.sessionId };
}
