'use client';

import dynamic from 'next/dynamic';
import { usePathname } from '@/i18n/navigation';

const DiaboPeek = dynamic(
  () => import('@/components/diabo/DiaboPeek').then((mod) => mod.DiaboPeek),
  { ssr: false },
);

export function DiaboPeekPortal() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/fr' || pathname === '/ar') {
    return null;
  }

  return <DiaboPeek />;
}
