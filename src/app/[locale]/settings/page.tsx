import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Parametres - Diabo',
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [session, t] = await Promise.all([
    auth(),
    getTranslations({ locale, namespace: 'settingsPage' }),
  ]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
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
        <SettingsForm signedIn={Boolean(session?.user?.id)} />
      </div>
    </main>
  );
}
