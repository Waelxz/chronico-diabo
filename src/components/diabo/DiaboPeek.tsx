'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { DiaboProvider } from '@/components/diabo/DiaboProvider';
import { DiaboStage } from '@/components/diabo/DiaboStage';

export function DiaboPeek() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;

      const dx = event.clientX / window.innerWidth * 2 - 1;
      const dy = event.clientY / window.innerHeight * 2 - 1;
      el.style.setProperty('--dx', dx.toFixed(3));
      el.style.setProperty('--dy', dy.toFixed(3));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-6 right-6 z-50 size-20 overflow-hidden rounded-full border border-emerald-200/70 bg-white/90 shadow-xl shadow-emerald-950/10 transition-all duration-200 hover:size-[120px] dark:border-emerald-900/60 dark:bg-zinc-950/90 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
      style={
        {
          '--dx': '0',
          '--dy': '0',
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="h-full w-full transition-transform duration-200 [transform:translate(calc(var(--dx)*4px),calc(var(--dy)*4px))_rotateX(calc(var(--dy)*-8deg))_rotateY(calc(var(--dx)*8deg))]">
        <DiaboProvider>
          <DiaboStage className="h-full w-full" />
        </DiaboProvider>
      </div>
    </div>
  );
}
