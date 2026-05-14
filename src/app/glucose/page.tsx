import type { Metadata } from 'next';
import { GlucoseTracker } from '@/components/glucose/GlucoseTracker';

export const metadata: Metadata = {
  title: 'Suivi glycémie · Diabo',
};

export default function GlucosePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            Chronico Diabo
          </p>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            Suivi de glycémie
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Enregistrez vos mesures, visualisez la tendance récente et demandez
            un résumé hebdomadaire en français.
          </p>
        </header>
        <GlucoseTracker />
      </div>
    </main>
  );
}
