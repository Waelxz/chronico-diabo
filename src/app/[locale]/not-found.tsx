import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <section className="diabo-surface w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Page introuvable
        </h1>
        <Link href="/" className="diabo-button-primary mt-6">
          Retour a l accueil
        </Link>
      </section>
    </main>
  );
}
