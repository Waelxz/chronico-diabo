'use client';

import { useEffect } from 'react';
import { useDiabo } from '@/components/diabo/DiaboProvider';

export function useDiaboLook() {
  const { patch } = useDiabo();

  useEffect(() => {
    function handle(e: MouseEvent) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      patch({ lookX: dx * 6, lookY: dy * 4 });
    }

    window.addEventListener('mousemove', handle, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handle);
      patch({ lookX: 0, lookY: 0 });
    };
  }, [patch]);
}
