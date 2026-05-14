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
    /*
     * Outer: clipping window — only top half of avatar is visible.
     * Height = half the avatar render size (96px visible, 192px canvas).
     * Positioned flush with the bottom edge.
     * Entrance: slides up 96px (its own height) from below the viewport.
     */
    <div
      className={`fixed bottom-0 right-6 z-50 h-36 w-40 overflow-hidden transition-transform duration-500 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden="true"
    >
      {/* Frosted strip behind the avatar so it reads on any background */}
      <div className="absolute inset-x-0 bottom-0 h-3 rounded-t-full bg-white/60 backdrop-blur-sm dark:bg-zinc-950/60" />
      {/* Canvas is 2.5× the clip height — top of avatar (head) sits in clip window */}
      <DiaboStage className="absolute inset-x-0 top-0 h-[340px] w-full" />
    </div>
  );
}
