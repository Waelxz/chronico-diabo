'use client';

import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import {
  DIABO_ARTBOARD,
  DIABO_RIVE_SRC,
  DIABO_STATE_MACHINE,
} from '@/lib/diabo/types';

export type DiaboStageProps = {
  className?: string;
  /** Disables auto-bound ViewModel updates (use false only when wiring tests). */
  autoBind?: boolean;
};

/**
 * Renders the Diabo Rive avatar with its `Diabo` state machine running.
 * In sprint 0 it just idles (Breathe + EyeIdle + BlinkLayer all autoplay).
 * Later sprints will wrap this with a context provider that drives the
 * `DiaboCon` ViewModel from emotion / chat / gaze inputs.
 */
export function DiaboStage({ className, autoBind = true }: DiaboStageProps) {
  const { RiveComponent } = useRive({
    src: DIABO_RIVE_SRC,
    artboard: DIABO_ARTBOARD,
    stateMachines: DIABO_STATE_MACHINE,
    autoplay: true,
    autoBind,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  });

  return <RiveComponent className={className} aria-label="Diabo, votre compagnon IA" />;
}
