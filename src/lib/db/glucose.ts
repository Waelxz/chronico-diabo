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
  sessionId: string;
  value: number;
  unit: GlucoseUnit;
  measuredAt: Date;
  context: GlucoseContext;
  note?: string;
};

export type NewGlucoseLog = Omit<GlucoseLog, '_id' | 'sessionId'>;

let glucoseIndexesPromise: Promise<void> | null = null;

async function glucoseCol(): Promise<Collection<GlucoseLog> | null> {
  const db = await getDb();
  return db ? db.collection<GlucoseLog>('glucose_logs') : null;
}

export async function ensureGlucoseIndexes(): Promise<void> {
  if (glucoseIndexesPromise) return glucoseIndexesPromise;
  const col = await glucoseCol();
  if (!col) return;
  glucoseIndexesPromise = col
    .createIndex(
      { sessionId: 1, measuredAt: -1 },
      { name: 'session_measuredAt_desc' },
    )
    .then(() => undefined);
  return glucoseIndexesPromise;
}

export async function insertLog(
  sessionId: string,
  log: NewGlucoseLog,
): Promise<GlucoseLog | null> {
  const col = await glucoseCol();
  if (!col) return null;
  const doc: GlucoseLog = {
    _id: new ObjectId(),
    sessionId,
    ...log,
  };
  await col.insertOne(doc);
  return doc;
}

export async function getLogsForSession(
  sessionId: string,
  limitDays = 30,
): Promise<GlucoseLog[]> {
  const col = await glucoseCol();
  if (!col) return [];
  const since = new Date();
  since.setDate(since.getDate() - limitDays);
  return col
    .find({
      sessionId,
      measuredAt: { $gte: since },
    })
    .sort({ measuredAt: -1 })
    .toArray();
}

export async function deleteLog(
  sessionId: string,
  logId: string,
): Promise<boolean> {
  const col = await glucoseCol();
  if (!col || !ObjectId.isValid(logId)) return false;
  const result = await col.deleteOne({
    _id: new ObjectId(logId),
    sessionId,
  });
  return result.deletedCount === 1;
}
