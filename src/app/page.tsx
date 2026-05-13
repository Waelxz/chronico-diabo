import { DiaboStage } from '@/components/diabo/DiaboStage';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-sky-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 px-6 py-12">
      <header className="mb-6 flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Chronico
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Diabo
        </h1>
        <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
          Votre compagnon IA empathique pour vivre avec le diabète au quotidien.
        </p>
      </header>

      <div className="relative aspect-square w-full max-w-md">
        <DiaboStage className="absolute inset-0 h-full w-full" />
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          Sprint 0 — l&apos;avatar respire, le chat arrive bientôt
        </span>
        <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-500">
          Projet M1 Big Data — IHEC. NLP + LLM + Empathie.
        </p>
      </div>
    </main>
  );
}
