import 'server-only';
import { type Collection } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type DiabetesType = '1' | '2' | 'gestational' | 'prediabetes' | 'other';

export type CompanionProfile = {
  sessionId: string;
  name?: string;
  diabetesType?: DiabetesType;
  treatment?: string;
  goals?: string[];
  restrictions?: string[];
  city?: string;
  updatedAt: Date;
};

let companionIndexesPromise: Promise<void> | null = null;

async function companionProfilesCol(): Promise<
  Collection<CompanionProfile> | null
> {
  const db = await getDb();
  return db ? db.collection<CompanionProfile>('companion_profiles') : null;
}

export async function ensureCompanionIndexes(): Promise<void> {
  if (companionIndexesPromise) return companionIndexesPromise;
  const col = await companionProfilesCol();
  if (!col) return;
  companionIndexesPromise = col
    .createIndex({ sessionId: 1 }, { name: 'sessionId_unique', unique: true })
    .then(() => undefined);
  return companionIndexesPromise;
}

export async function getProfile(
  sessionId: string,
): Promise<CompanionProfile | null> {
  const col = await companionProfilesCol();
  if (!col) return null;
  return col.findOne({ sessionId });
}

export async function upsertProfile(
  sessionId: string,
  partial: Partial<CompanionProfile>,
): Promise<CompanionProfile | null> {
  const col = await companionProfilesCol();
  if (!col) return null;
  const safe = { ...partial };
  delete safe.sessionId;
  delete safe.updatedAt;
  const updatedAt = new Date();
  await col.updateOne(
    { sessionId },
    {
      $set: {
        ...safe,
        updatedAt,
      },
      $setOnInsert: { sessionId },
    },
    { upsert: true },
  );
  return col.findOne({ sessionId });
}
