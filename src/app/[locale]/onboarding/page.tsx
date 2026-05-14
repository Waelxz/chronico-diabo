import type { Metadata } from 'next';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export const metadata: Metadata = {
  title: 'Personnaliser Diabo · Diabo',
};

export default function OnboardingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <OnboardingFlow />
    </main>
  );
}
