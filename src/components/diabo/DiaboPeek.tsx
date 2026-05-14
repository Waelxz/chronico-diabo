'use client';

import { useEffect, useState } from 'react';
import { DiaboProvider, useDiabo } from '@/components/diabo/DiaboProvider';
import { DiaboStage } from '@/components/diabo/DiaboStage';

export function DiaboPeek() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <DiaboProvider>
      <DiaboPeekInner visible={visible} />
    </DiaboProvider>
  );
}

function DiaboPeekInner({ visible }: { visible: boolean }) {
  const { patch } = useDiabo();

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (event.clientX - cx) / cx;
      const dy = (event.clientY - cy) / cy;
      patch({ lookX: dx * 6, lookY: dy * 4 });
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      patch({ lookX: 0, lookY: 0 });
    };
  }, [patch]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 size-24 overflow-hidden rounded-full border border-emerald-200/70 bg-white/90 shadow-xl shadow-emerald-950/10 transition-all duration-200 dark:border-emerald-900/60 dark:bg-zinc-950/90 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
      aria-hidden="true"
    >
      <DiaboStage className="h-full w-full" />
    </div>
  );
}
