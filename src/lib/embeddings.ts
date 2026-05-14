import 'server-only';
import { featureExtraction } from '@huggingface/inference';
import { getEnv } from './env';

/**
 * Text → vector embeddings via the HuggingFace Inference SDK.
 *
 * Model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
 *  - 384 dimensions
 *  - Multilingual (50+ languages including French & Arabic)
 *  - Same model validated in `notebooks/pipeline_nlp.ipynb` for BERTopic
 *
 * Provider: `hf-inference` (free serverless tier).
 *
 * Used for: indexing the diabetes knowledge base (`kb_chunks`) and embedding
 * user queries at retrieval time. Same model both sides ⇒ same vector space.
 */

export const EMBEDDING_MODEL =
  'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
export const EMBEDDING_DIM = 384;

export async function embedText(text: string): Promise<number[]> {
  const env = getEnv();
  if (!env.HUGGINGFACE_ACCESS_TOKEN) {
    throw new Error('[embeddings] HUGGINGFACE_ACCESS_TOKEN is not set');
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('[embeddings] empty text');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 4_000);

  const raw = await featureExtraction(
    {
      accessToken: env.HUGGINGFACE_ACCESS_TOKEN,
      model: EMBEDDING_MODEL,
      provider: 'hf-inference',
      inputs: trimmed.slice(0, 2000),
    },
    { signal: controller.signal },
  ).catch((err) => {
    if (timedOut) {
      throw new Error('[embeddings] HuggingFace request timed out after 4000ms');
    }
    throw err;
  }).finally(() => {
    clearTimeout(timeout);
  });

  // HF can return number[] for a single input (mean-pooled) or number[][] for
  // token-level. Sentence-transformers models return a single 384-vector by
  // default. Normalize both shapes.
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
    return raw as number[];
  }
  if (
    Array.isArray(raw) &&
    raw.length === 1 &&
    Array.isArray(raw[0]) &&
    typeof (raw[0] as number[])[0] === 'number'
  ) {
    return raw[0] as number[];
  }
  throw new Error(
    `[embeddings] unexpected output shape from HF (len=${Array.isArray(raw) ? raw.length : 'n/a'})`,
  );
}

/** Batched version for ingestion. Calls HF once per text — simpler & rate-limit friendly. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embedText(t));
  }
  return out;
}
