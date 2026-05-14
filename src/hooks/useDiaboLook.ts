'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useDiabo } from '@/components/diabo/DiaboProvider';

export function useDiaboLook(containerRef?: RefObject<HTMLElement | null>) {
  const { patch } = useDiabo();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function handle(e: MouseEvent) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        let cx: number;
        let cy: number;

        if (containerRef?.current) {
          const rect = containerRef.current.getBoundingClientRect();
          cx = rect.left + rect.width / 2;
          cy = rect.top + rect.height / 2;
        } else {
          cx = window.innerWidth / 2;
          cy = window.innerHeight / 2;
        }

        const rawDx = e.clientX - cx;
        const rawDy = e.clientY - cy;
        const maxDist = Math.max(window.innerWidth, window.innerHeight) / 2;
        const dx = Math.max(-1, Math.min(1, rawDx / maxDist));
        const dy = Math.max(-1, Math.min(1, rawDy / maxDist));

        patch({ lookX: dx * 6, lookY: dy * 4 });
      });
    }

    window.addEventListener('mousemove', handle, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handle);
      cancelAnimationFrame(rafRef.current);
      patch({ lookX: 0, lookY: 0 });
    };
  }, [patch, containerRef]);
}
