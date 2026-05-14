'use client';

import { DiaboStage } from '@/components/diabo/DiaboStage';
import { useDiaboLook } from '@/hooks/useDiaboLook';

export function HomeDiaboStage() {
  useDiaboLook();

  return <DiaboStage className="h-full w-full" />;
}
