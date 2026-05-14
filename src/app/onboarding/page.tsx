import type { Metadata } from 'next';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';

export const metadata: Metadata = {
  title: 'Personnaliser Diabo · Diabo',
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            Chronico Diabo
          </p>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
            Personnaliser Diabo
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Ajoutez quelques préférences pour aider Diabo à répondre avec plus
            de contexte, sans remplacer l&apos;avis de votre médecin.
          </p>
        </header>
        <OnboardingForm />
      </div>
    </main>
  );
}
