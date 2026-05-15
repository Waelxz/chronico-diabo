import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface User {
  _id: string;
  email: string;
  hashedPassword: string | null;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type UserDoc = Omit<User, '_id'> & {
  _id: ObjectId;
};

type CreateUserInput = {
  email: string;
  hashedPassword: string;
  name: string;
};

let usersIndexesPromise: Promise<void> | null = null;

async function usersCol(): Promise<Collection<UserDoc> | null> {
  const db = await getDb();
  return db ? db.collection<UserDoc>('users') : null;
}

async function ensureUsersIndexes(): Promise<void> {
  if (usersIndexesPromise) return usersIndexesPromise;
  const col = await usersCol();
  usersIndexesPromise = col
    ? col
        .createIndex({ email: 1 }, { name: 'email_unique', unique: true })
        .then(() => undefined)
    : Promise.resolve();
  return usersIndexesPromise;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function serializeUser(doc: UserDoc): User {
  return {
    ...doc,
    _id: doc._id.toHexString(),
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await ensureUsersIndexes();
  const col = await usersCol();
  if (!col) return null;
  const doc = await col.findOne({ email: normalizeEmail(email) });
  return doc ? serializeUser(doc) : null;
}

export async function createUser({
  email,
  hashedPassword,
  name,
}: CreateUserInput): Promise<User | null> {
  await ensureUsersIndexes();
  const col = await usersCol();
  if (!col) return null;
  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: normalizeEmail(email),
    hashedPassword,
    name: name.trim() || null,
    image: null,
    emailVerified: null,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc);
  return serializeUser(doc);
}

export async function updateUserPassword(
  userId: string,
  hashedPassword: string,
): Promise<User | null> {
  if (!ObjectId.isValid(userId)) return null;
  const col = await usersCol();
  if (!col) return null;
  const _id = new ObjectId(userId);
  await col.updateOne({ _id }, { $set: { hashedPassword, updatedAt: new Date() } });
  const doc = await col.findOne({ _id });
  return doc ? serializeUser(doc) : null;
}
