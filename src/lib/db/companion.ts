import 'server-only';
import { type Collection } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type DiabetesType = '1' | '2' | 'gestational' | 'prediabetes' | 'other';
export type Gender = 'male' | 'female' | 'other';

export type CompanionProfile = {
  sessionId?: string;
  userId?: string;
  name?: string;
  birthDate?: string;
  gender?: Gender;
  heightCm?: number;
  weightKg?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  diabetesType?: DiabetesType;
  treatment?: string;
  goals?: string[];
  restrictions?: string[];
  city?: string;
  updatedAt: Date;
};

export type OwnerKey =
  | { sessionId: string; userId?: never }
  | { userId: string; sessionId?: never };

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
  companionIndexesPromise = Promise.all([
    col.createIndex({ sessionId: 1 }, { name: 'sessionId_unique', unique: true }),
    col.createIndex({ userId: 1 }, { name: 'userId_sparse', sparse: true }),
  ]).then(() => undefined);
  return companionIndexesPromise;
}

export async function getProfile(
  key: OwnerKey,
): Promise<CompanionProfile | null> {
  const col = await companionProfilesCol();
  if (!col) return null;
  return col.findOne(ownerFilter(key));
}

export async function upsertProfile(
  key: OwnerKey,
  partial: Partial<CompanionProfile>,
): Promise<CompanionProfile | null> {
  const col = await companionProfilesCol();
  if (!col) return null;
  const safe = { ...partial };
  delete safe.sessionId;
  delete safe.userId;
  delete safe.updatedAt;
  const updatedAt = new Date();
  const filter = ownerFilter(key);
  await col.updateOne(
    filter,
    {
      $set: {
        ...safe,
        updatedAt,
      },
      $setOnInsert: filter,
    },
    { upsert: true },
  );
  return col.findOne(filter);
}

export async function transferAnonProfileToUser(
  sessionId: string,
  userId: string,
): Promise<void> {
  const col = await companionProfilesCol();
  if (!col) return;
  await col.updateMany({ sessionId }, { $set: { userId } });
}

function ownerFilter(key: OwnerKey): OwnerKey {
  return key.userId !== undefined
    ? { userId: key.userId }
    : { sessionId: key.sessionId };
}
