import 'server-only';
import { textClassification } from '@huggingface/inference';
import { getEnv } from './env';

/**
 * Sentiment / emotion inference via HuggingFace.
 *
 * Same model as the offline notebook (`notebooks/pipeline_nlp.ipynb`) so the
 * report's headline numbers stay reproducible against what the live app does:
 *   - `cardiffnlp/twitter-xlm-roberta-base-sentiment` (multilingual)
 *   - Pearson r = 0.765 against star ratings on 33k+ reviews
 *
 * We use the `@huggingface/inference` SDK which routes through HF's new
 * router (`router.huggingface.co`). The legacy `api-inference.huggingface.co`
 * endpoint was deprecated in early 2026; the SDK abstracts the new providers
 * model so we don't have to chase URL changes.
 *
 * Provider: `hf-inference` (HF's own serverless tier — closest equivalent of
 * the old free Inference API, fits the project's "zero paid services" rule).
 * First-call cold-start can still take ~10-20s; subsequent calls are fast.
 */

const SENTIMENT_MODEL = 'cardiffnlp/twitter-xlm-roberta-base-sentiment';

export type EmotionLabel = 'positive' | 'neutral' | 'negative';

export type EmotionResult = {
  label: EmotionLabel;
  /** Confidence of the winning label, 0..1. */
  score: number;
  /** Full distribution, sorted desc. Useful for analytics / debugging. */
  scores: Array<{ label: EmotionLabel; score: number }>;
};

function normalizeLabel(raw: string): EmotionLabel {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('positive') || lower === 'pos' || lower === 'label_2') {
    return 'positive';
  }
  if (lower.includes('negative') || lower === 'neg' || lower === 'label_0') {
    return 'negative';
  }
  return 'neutral';
}

export async function analyzeEmotion(text: string): Promise<EmotionResult> {
  const env = getEnv();
  if (!env.HUGGINGFACE_ACCESS_TOKEN) {
    throw new Error(
      '[emotion] HUGGINGFACE_ACCESS_TOKEN is not set — get one at https://huggingface.co/settings/tokens (Read scope is enough).',
    );
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('[emotion] empty text');
  }

  // cardiffnlp truncates at 512 tokens; 1000 chars is a comfortable upper bound.
  const inputs = trimmed.slice(0, 1000);

  const raw = await textClassification({
    accessToken: env.HUGGINGFACE_ACCESS_TOKEN,
    model: SENTIMENT_MODEL,
    provider: 'hf-inference',
    inputs,
  });

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('[emotion] HF returned no classifications');
  }

  const scores = raw
    .map<{ label: EmotionLabel; score: number }>((r) => ({
      label: normalizeLabel(r.label),
      score: r.score,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    label: scores[0].label,
    score: scores[0].score,
    scores,
  };
}
