import { upsertChunk, countChunks } from '@/lib/db/kb';
import { KB_SEED } from '@/lib/diabo/knowledge';

/**
 * POST /api/admin/seed-kb
 *
 * One-shot ingestion route for the diabetes KB. Idempotent (upserts by title),
 * so re-running just refreshes embeddings.
 *
 * Disabled in production unless the explicit `ALLOW_KB_SEED=1` env var is set.
 * Local dev uses the same Atlas cluster as prod, so seeding locally also
 * populates production — no need to re-seed on Vercel for sprint 3.
 *
 * Curl:
 *   curl -X POST http://localhost:3000/api/admin/seed-kb
 */

export const runtime = 'nodejs';
// HF cold-start + 14 chunk embeddings can push past 30s.
export const maxDuration = 120;

export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_KB_SEED !== '1') {
    return Response.json(
      { error: 'disabled_in_production', hint: 'set ALLOW_KB_SEED=1 to enable' },
      { status: 403 },
    );
  }

  const start = Date.now();
  const failures: Array<{ title: string; error: string }> = [];
  let upserted = 0;

  for (const chunk of KB_SEED) {
    try {
      await upsertChunk(chunk.topic, chunk.title, chunk.content);
      upserted += 1;
    } catch (err) {
      failures.push({
        title: chunk.title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const total = await countChunks().catch(() => -1);

  return Response.json({
    ok: failures.length === 0,
    upserted,
    failures,
    totalInCollection: total,
    elapsedMs: Date.now() - start,
  });
}
