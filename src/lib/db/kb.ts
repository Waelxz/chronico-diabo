import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { getDb } from '../mongodb';
import { embedText, EMBEDDING_DIM } from '../embeddings';

/**
 * Diabetes knowledge base — Mongo Atlas Vector Search.
 *
 * Schema:
 *   - `topic`    : coarse bucket ('food' | 'hypo' | 'activity' | 'mental' | …)
 *   - `title`    : short human-readable label, used as a citation in answers
 *   - `content`  : the chunk text itself, in French
 *   - `embedding`: 384-dim vector from `sentence-transformers/paraphrase-…`
 *
 * Index: `kb_chunks_vector` (Atlas Vector Search), cosine similarity, 384 dims.
 * Free M0 tier supports up to 5 vector indexes total.
 *
 * Retrieval policy:
 *   - Top 3 chunks per query
 *   - We do NOT filter by topic — let the vector ranking do the work
 *   - If retrieval fails (Mongo down, index missing), `searchKb` returns []
 *     and the chat still works without KB context
 */

export const KB_VECTOR_INDEX = 'kb_chunks_vector';

export type KbTopic =
  | 'concept'
  | 'food'
  | 'activity'
  | 'monitoring'
  | 'hypo'
  | 'hyper'
  | 'mental'
  | 'travel'
  | 'ramadan'
  | 'pregnancy';

export type KbChunkDoc = {
  _id: ObjectId;
  topic: KbTopic;
  title: string;
  content: string;
  embedding: number[];
  createdAt: Date;
};

export type KbChunkResult = Omit<KbChunkDoc, 'embedding'> & {
  /** Cosine similarity to the query, 0..1. */
  score: number;
};

async function kbChunksCol(): Promise<Collection<KbChunkDoc> | null> {
  const db = await getDb();
  return db ? db.collection<KbChunkDoc>('kb_chunks') : null;
}

/** Replace-or-insert a chunk by `title` (idempotent — safe to re-run seed). */
export async function upsertChunk(
  topic: KbTopic,
  title: string,
  content: string,
): Promise<void> {
  const col = await kbChunksCol();
  if (!col) throw new Error('[kb] Mongo not configured');
  const embedding = await embedText(`${title}. ${content}`);
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `[kb] embedding dim mismatch (got ${embedding.length}, expected ${EMBEDDING_DIM})`,
    );
  }
  await col.updateOne(
    { title },
    {
      $set: { topic, title, content, embedding, createdAt: new Date() },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
}

/** Vector-search the KB for the top-K closest chunks to `query`. */
export async function searchKb(
  query: string,
  limit = 3,
): Promise<KbChunkResult[]> {
  const col = await kbChunksCol();
  if (!col) return [];
  let queryVector: number[];
  try {
    queryVector = await embedText(query);
  } catch (err) {
    console.warn('[kb] embedText failed, skipping retrieval:', err);
    return [];
  }
  try {
    const cursor = col.aggregate<KbChunkResult>([
      {
        $vectorSearch: {
          index: KB_VECTOR_INDEX,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(limit * 10, 30),
          limit,
        },
      },
      {
        $project: {
          embedding: 0,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
    return await cursor.toArray();
  } catch (err) {
    console.warn('[kb] $vectorSearch failed:', err);
    return [];
  }
}

/** Count chunks (for the seed script to report progress). */
export async function countChunks(): Promise<number> {
  const col = await kbChunksCol();
  if (!col) return 0;
  return col.countDocuments();
}
