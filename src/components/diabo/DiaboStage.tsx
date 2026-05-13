'use client';

import { useEffect } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModelInstanceBoolean,
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
 * the React-side lifecycle (`isTalking`, `isThinking`) into Rive whenever
 * `<DiaboProvider>` updates. The avatar must live under a `DiaboProvider`.
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
  const { isThinking, isTalking } = useDiaboState();

  const { setValue: setRiveTalking } = useViewModelInstanceBoolean(
    'isTalking',
    vm,
  );
  const { setValue: setRiveThinking } = useViewModelInstanceBoolean(
    'isThinking',
    vm,
  );

  useEffect(() => {
    setRiveTalking(Boolean(isTalking));
  }, [isTalking, setRiveTalking]);

  useEffect(() => {
    setRiveThinking(Boolean(isThinking));
  }, [isThinking, setRiveThinking]);

  return (
    <RiveComponent
      className={className}
      aria-label="Diabo, votre compagnon IA"
    />
  );
}
