import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HotelList } from '@/components/hotels/HotelList';

export const metadata: Metadata = {
  title: 'Hôtels adaptés au diabète · Diabo',
};

export default async function HotelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'hotels' });
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            Chronico Diabo
          </p>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {t('description')}
          </p>
        </header>
        <HotelList />
      </div>
    </main>
  );
}
