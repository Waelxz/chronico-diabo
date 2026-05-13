import { ChatPanel } from '@/components/chat/ChatPanel';
import { DiaboProvider } from '@/components/diabo/DiaboProvider';
import { DiaboStage } from '@/components/diabo/DiaboStage';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col bg-gradient-to-b from-emerald-50 via-white to-sky-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <DiaboProvider>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:py-14">
          <header className="flex flex-col items-center gap-2 text-center">
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

          <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-stretch">
            <div className="flex items-center justify-center">
              <div className="relative aspect-square w-full max-w-md">
                <DiaboStage className="absolute inset-0 h-full w-full" />
              </div>
            </div>
            <ChatPanel className="w-full" />
          </div>

          <footer className="flex flex-col items-center gap-2 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Sprint 1 — chat empathique en streaming, Diabo parle quand il répond
            </span>
            <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-500">
              Projet M1 Big Data — IHEC. NLP + LLM + Empathie.
            </p>
          </footer>
        </div>
      </DiaboProvider>
    </main>
  );
}
