'use client';

import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
  unstable_retry,
}: {
  error: Error;
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  const retry = reset ?? unstable_retry;
  const message =
    error.message.length > 120
      ? `${error.message.slice(0, 117)}...`
      : error.message;

  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <section className="diabo-surface w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Une erreur est survenue
        </h1>
        {message ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={retry}
            disabled={!retry}
            className="diabo-button-primary"
          >
            Reessayer
          </button>
          <Link href="/" className="diabo-button-secondary">
            Retour a l accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
