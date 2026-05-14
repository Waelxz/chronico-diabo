'use client';

import { useEffect } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
} from '@rive-app/react-canvas';
import {
  DIABO_ARTBOARD,
  DIABO_RIVE_SRC,
  DIABO_STATE_MACHINE,
} from '@/lib/diabo/types';
import { useDiaboState } from './DiaboProvider';

export type DiaboStageProps = {
  className?: string;
};

/**
 * Renders the Diabo Rive avatar with its `Diabo` state machine running.
 *
 * The `Diabo` artboard auto-binds the `DiaboCon` ViewModel, then we push
 * the React-side lifecycle and emotion-driven state into Rive whenever
 * `<DiaboProvider>` updates. The avatar must live under a `DiaboProvider`.
 *
 * Channels mirrored to Rive:
 *   - `isTalking`, `isThinking`   → boolean   (chat lifecycle)
 *   - `mouthState`                → number    (0..8, resting mouth pose)
 *   - `eyebrowMood`               → number    (0..4, sentiment-driven)
 *   - `eyelidState`               → number    (0..1, fatigue cue)
 *   - `lookX`, `lookY`             → number    (pupil tracking, px offsets)
 *   - `happiness`                 → number    (0..1, tail wag threshold ≥ 0.3)
 */
export function DiaboStage({ className }: DiaboStageProps) {
  const { rive, RiveComponent } = useRive({
    src: DIABO_RIVE_SRC,
    artboard: DIABO_ARTBOARD,
    stateMachines: DIABO_STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  });

  const vm = rive?.viewModelInstance ?? null;
  const {
    isThinking,
    isTalking,
    mouthState,
    eyebrowMood,
    eyelidState,
    lookX,
    lookY,
    happiness,
  } = useDiaboState();

  // Boolean channels.
  const { setValue: setRiveTalking } = useViewModelInstanceBoolean(
    'isTalking',
    vm,
  );
  const { setValue: setRiveThinking } = useViewModelInstanceBoolean(
    'isThinking',
    vm,
  );

  // Number channels.
  const { setValue: setRiveMouth } = useViewModelInstanceNumber(
    'mouthState',
    vm,
  );
  const { setValue: setRiveEyebrow } = useViewModelInstanceNumber(
    'eyebrowMood',
    vm,
  );
  const { setValue: setRiveEyelid } = useViewModelInstanceNumber(
    'eyelidState',
    vm,
  );
  const { setValue: setRiveHappiness } = useViewModelInstanceNumber(
    'happiness',
    vm,
  );
  const { setValue: setRiveLookX } = useViewModelInstanceNumber('lookX', vm);
  const { setValue: setRiveLookY } = useViewModelInstanceNumber('lookY', vm);

  useEffect(() => {
    setRiveTalking(Boolean(isTalking));
  }, [isTalking, setRiveTalking]);

  useEffect(() => {
    setRiveThinking(Boolean(isThinking));
  }, [isThinking, setRiveThinking]);

  useEffect(() => {
    if (mouthState !== undefined) setRiveMouth(mouthState);
  }, [mouthState, setRiveMouth]);

  useEffect(() => {
    if (eyebrowMood !== undefined) setRiveEyebrow(eyebrowMood);
  }, [eyebrowMood, setRiveEyebrow]);

  useEffect(() => {
    if (eyelidState !== undefined) setRiveEyelid(eyelidState);
  }, [eyelidState, setRiveEyelid]);

  useEffect(() => {
    if (happiness !== undefined) setRiveHappiness(happiness);
  }, [happiness, setRiveHappiness]);

  useEffect(() => {
    if (lookX !== undefined) setRiveLookX(lookX);
  }, [lookX, setRiveLookX]);

  useEffect(() => {
    if (lookY !== undefined) setRiveLookY(lookY);
  }, [lookY, setRiveLookY]);

  return (
    <RiveComponent
      className={className}
      aria-label="Diabo, votre compagnon IA"
    />
  );
}
