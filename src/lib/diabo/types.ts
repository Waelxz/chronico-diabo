/**
 * Diabo avatar control surface — matches the `DiaboCon` ViewModel
 * exposed by `public/diabo.riv` (state machine `Diabo`, 9 layers).
 *
 * See: https://github.com/Waelxz/chibi-dino-avatar/blob/main/docs/rive-api.md
 */

export const DIABO_RIVE_SRC = '/diabo.riv';
export const DIABO_ARTBOARD = 'Artboard';
export const DIABO_STATE_MACHINE = 'Diabo';
export const DIABO_VIEW_MODEL = 'DiaboCon';

/** Mouth pose number → human-readable shape (matches MouthPoseLayer). */
export const MOUTH_STATES = {
  closed: 0,
  smile: 1,
  open: 2,
  open_big: 3,
  open_small_o: 4,
  smile_closed: 5,
  smirk: 6,
  sad_worried: 7,
  sad_small: 8,
} as const;
export type MouthState = (typeof MOUTH_STATES)[keyof typeof MOUTH_STATES];

/** Brow pose number → human-readable mood (matches EyebrowLayer). */
export const EYEBROW_MOODS = {
  neutral: 0,
  happy: 1,
  sad: 2,
  worried: 3,
  judging: 4,
} as const;
export type EyebrowMood = (typeof EYEBROW_MOODS)[keyof typeof EYEBROW_MOODS];

/** 0 = open, 1 = half-closed (combine with eyebrowMood for tired/unamused). */
export const EYELID_STATES = { open: 0, half: 1 } as const;
export type EyelidState = (typeof EYELID_STATES)[keyof typeof EYELID_STATES];

/**
 * Full snapshot of values React can drive on the Rive ViewModel.
 * Every field is optional — only provided values are written, the rest hold.
 */
export type DiaboState = {
  mouthState?: MouthState;
  eyebrowMood?: EyebrowMood;
  eyelidState?: EyelidState;
  isTalking?: boolean;
  isThinking?: boolean;
  /** -6..6 px, additive over autonomous saccades. */
  lookX?: number;
  /** -4..4 px. */
  lookY?: number;
  /** -0.04..0.04 rad (~±2.3°). */
  headTurn?: number;
  /** 0..1; tail wags when > 0.3. */
  happiness?: number;
};

/**
 * Compound preset → multiple props at once. Use as a quick "feel" for Diabo.
 * From `docs/rive-api.md` examples.
 */
export const DIABO_PRESETS = {
  neutral: { mouthState: 0, eyebrowMood: 0, eyelidState: 0, happiness: 0.5 },
  happy: { mouthState: 1, eyebrowMood: 1, eyelidState: 0, happiness: 1 },
  sad: { mouthState: 8, eyebrowMood: 2, eyelidState: 1, happiness: 0 },
  worried: { mouthState: 7, eyebrowMood: 3, eyelidState: 0, happiness: 0.1 },
  tired: { mouthState: 0, eyebrowMood: 2, eyelidState: 1 },
  unamused: { mouthState: 0, eyebrowMood: 0, eyelidState: 1 },
  suspicious: { mouthState: 6, eyebrowMood: 4, eyelidState: 1 },
  excited: { mouthState: 3, eyebrowMood: 1, eyelidState: 0, happiness: 1 },
} as const satisfies Record<string, DiaboState>;
export type DiaboPreset = keyof typeof DIABO_PRESETS;
