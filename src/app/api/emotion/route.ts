import { analyzeEmotion } from '@/lib/emotion';

/**
 * POST /api/emotion  →  { label, score, scores }
 *
 * Body: { text: string }
 *
 * Used by the client to drive Diabo's facial preset (eyebrows, mouth,
 * happiness) so the avatar reflects empathetic concern when the user is
 * negative, warmth when positive, and resting attentiveness when neutral.
 *
 * Fire-and-forget from the client — failure is non-fatal; Diabo just stays
 * in the previous state. We never let HF rate-limits or cold-starts block
 * the chat flow.
 */

export const runtime = 'nodejs';
export const maxDuration = 25; // HF cold-start can hit ~20s

export async function POST(req: Request) {
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const text = body.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return Response.json({ error: 'text_required' }, { status: 400 });
  }

  try {
    const result = await analyzeEmotion(text);
    return Response.json(result);
  } catch (err) {
    console.error('[emotion] inference failed:', err);
    return Response.json({ error: 'inference_failed' }, { status: 502 });
  }
}
