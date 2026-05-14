import type { Metadata } from 'next';
import { HotelList } from '@/components/hotels/HotelList';

export const metadata: Metadata = {
  title: 'Hôtels adaptés au diabète · Diabo',
};

export default function HotelsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            Chronico Diabo
          </p>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            Hôtels adaptés au diabète
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Comparez des hébergements proches avec une lecture simple de
            l’accessibilité et du niveau de confort pour mieux préparer vos
            déplacements.
          </p>
        </header>
        <HotelList />
      </div>
    </main>
  );
}
