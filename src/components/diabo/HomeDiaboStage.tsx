'use client';

import { useRef } from 'react';
import { DiaboStage } from '@/components/diabo/DiaboStage';
import { useDiaboLook } from '@/hooks/useDiaboLook';

export function HomeDiaboStage({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useDiaboLook(ref);

  return (
    <div ref={ref} className={`h-full w-full ${className ?? ''}`}>
      <DiaboStage className="h-full w-full" />
    </div>
  );
}
