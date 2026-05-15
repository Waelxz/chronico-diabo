'use client';

import { useState, type FormEvent } from 'react';
import { Link } from '@/i18n/navigation';
import { signUpWithEmail } from '@/lib/auth-actions';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      setPending(false);
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      setPending(false);
      return;
    }

    const result = await signUpWithEmail(email, password, name);
    if (result.success) {
      window.location.assign('/');
      return;
    }

    setError(result.error ?? 'Création du compte impossible.');
    setPending(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <section className="diabo-surface w-full max-w-md p-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            Diabo
          </p>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Créer un compte
          </h1>
        </div>

        {error ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
          <input
            className="diabo-field"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Votre nom"
            required
          />
          <input
            className="diabo-field"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Votre email"
            required
          />
          <input
            className="diabo-field"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mot de passe"
            minLength={8}
            required
          />
          <input
            className="diabo-field"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirmer le mot de passe"
            minLength={8}
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="diabo-button-primary w-full"
          >
            {pending ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Déjà un compte ?{' '}
          <Link
            href="/login"
            className="font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
          >
            Se connecter
          </Link>
        </p>
      </section>
    </main>
  );
}
