import type { EmotionLabel } from '@/lib/emotion';
import type { DiaboPreset } from './types';

/**
 * User sentiment → Diabo's empathetic facial preset.
 *
 * Important: this is **not** a mirroring map. If the user is sad, we don't
 * make Diabo sad too (that would amplify the negativity). Diabo *reflects
 * concern* — worried/attentive — and the LLM does the verbal empathy.
 *
 * Calibration logic:
 *   - positive → 'happy'     (warm smile, wagging tail — celebrates with the user)
 *   - neutral  → 'neutral'   (resting, attentive — invites the user to share more)
 *   - negative → 'worried'   (concerned eyebrows, soft mouth — empathetic, not dragging the user down)
 */
export function emotionToPreset(label: EmotionLabel): DiaboPreset {
  switch (label) {
    case 'positive':
      return 'happy';
    case 'negative':
      return 'worried';
    case 'neutral':
    default:
      return 'neutral';
  }
}
