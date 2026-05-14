// Squelette de chargement pour les transitions de page.
export default function Loading() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-4 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="diabo-skeleton h-16 w-full" aria-hidden="true" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="diabo-skeleton h-80 w-full" aria-hidden="true" />
          <div className="diabo-skeleton h-80 w-full" aria-hidden="true" />
        </div>
        <div className="diabo-skeleton h-14 w-full rounded-full" aria-hidden="true" />
      </div>
    </main>
  );
}
