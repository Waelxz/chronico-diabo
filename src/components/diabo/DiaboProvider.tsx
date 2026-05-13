'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DiaboPreset, DiaboState } from '@/lib/diabo/types';
import { DIABO_PRESETS } from '@/lib/diabo/types';

/**
 * Sprint-1 lifecycle channel for the Diabo avatar.
 *
 * Anything that wants to drive Diabo (chat panel today, emotion detector
 * tomorrow, recos later) reads this context and calls the setters. The
 * `DiaboStage` consumer pushes the state into the Rive ViewModel.
 *
 * IMPORTANT: this is the *only* sanctioned channel between React and Diabo
 * — per AGENTS.md, we never reach into Rive directly from feature code.
 */

export type DiaboLifecycleState = DiaboState & {
  /** True while waiting for the LLM's first token. */
  isThinking?: boolean;
  /** True while tokens are streaming in. Drives the mouth. */
  isTalking?: boolean;
};

type DiaboContextValue = {
  state: DiaboLifecycleState;
  setIsThinking: (v: boolean) => void;
  setIsTalking: (v: boolean) => void;
  setPreset: (p: DiaboPreset) => void;
  /** Patch any subset of avatar props. Useful for emotion-aware updates. */
  patch: (p: Partial<DiaboLifecycleState>) => void;
  reset: () => void;
};

const DEFAULT_STATE: DiaboLifecycleState = {
  ...DIABO_PRESETS.neutral,
  isThinking: false,
  isTalking: false,
};

const DiaboCtx = createContext<DiaboContextValue | null>(null);

export function DiaboProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiaboLifecycleState>(DEFAULT_STATE);

  const patch = useCallback((p: Partial<DiaboLifecycleState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const setIsThinking = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isThinking: v }));
  }, []);

  const setIsTalking = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isTalking: v }));
  }, []);

  const setPreset = useCallback((p: DiaboPreset) => {
    setState((prev) => ({ ...prev, ...DIABO_PRESETS[p] }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const value = useMemo<DiaboContextValue>(
    () => ({ state, setIsThinking, setIsTalking, setPreset, patch, reset }),
    [state, setIsThinking, setIsTalking, setPreset, patch, reset],
  );

  return <DiaboCtx.Provider value={value}>{children}</DiaboCtx.Provider>;
}

export function useDiabo(): DiaboContextValue {
  const ctx = useContext(DiaboCtx);
  if (!ctx) {
    throw new Error('useDiabo must be used inside <DiaboProvider>');
  }
  return ctx;
}

/** Read-only state hook for the DiaboStage (and tests). */
export function useDiaboState(): DiaboLifecycleState {
  return useDiabo().state;
}
