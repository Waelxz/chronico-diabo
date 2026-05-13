import 'server-only';
import { MongoClient, type Db } from 'mongodb';
import { getEnv } from './env';

/**
 * MongoDB Atlas client (lazy-initialised, cached across HMR reloads).
 * Returns `null` if `MONGODB_URI` is not yet configured — callers should
 * handle the "not yet wired" case gracefully during sprint 0.
 */
declare global {
  var __mongoClient: Promise<MongoClient | null> | undefined;
}

function createClient(): Promise<MongoClient | null> {
  const env = getEnv();
  if (!env.MONGODB_URI) {
    console.warn('[mongodb] MONGODB_URI not set — DB features disabled');
    return Promise.resolve(null);
  }
  const client = new MongoClient(env.MONGODB_URI, {
    appName: 'chronico-diabo',
  });
  return client.connect().catch((err) => {
    console.error('[mongodb] connection failed:', err);
    return null;
  });
}

export function getMongoClient(): Promise<MongoClient | null> {
  if (!global.__mongoClient) {
    global.__mongoClient = createClient();
  }
  return global.__mongoClient;
}

export async function getDb(): Promise<Db | null> {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db(getEnv().MONGODB_DB);
}
