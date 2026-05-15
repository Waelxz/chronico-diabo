'use client';

import { use, useState, type FormEvent } from 'react';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Link } from '@/i18n/navigation';
import { signInWithCredentials, signInWithGoogle } from '@/lib/auth-actions';

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    callbackUrl?: string | string[];
  }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Email ou mot de passe incorrect.',
  OAuthAccountNotLinked:
    'Cet email est déjà lié à une autre méthode de connexion.',
  AccessDenied: 'Accès refusé.',
  Verification: 'Le lien de vérification est invalide ou expiré.',
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const query = use(searchParams);
  const errorParam = firstValue(query.error);
  const callbackUrl = getSafeCallbackUrl(firstValue(query.callbackUrl));
  const [error, setError] = useState<string | null>(
    errorParam ? ERROR_MESSAGES[errorParam] ?? 'Connexion impossible.' : null,
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const result = await signInWithCredentials(email, password);

    if (result.success) {
      window.location.assign(callbackUrl);
      return;
    }

    setError(result.error ?? 'Connexion impossible.');
    setPending(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <section className="diabo-surface w-full max-w-md p-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            Chronico
          </p>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Connexion Chronico
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Votre compte Chronico vous donne accès à Diabo et nos futurs services.
          </p>
        </div>

        {error ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            className="diabo-button-secondary inline-flex w-full items-center justify-center gap-2"
          >
            <GoogleIcon className="size-5 shrink-0" />
            Continuer avec Google
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span>ou</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
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
            autoComplete="current-password"
            placeholder="Mot de passe"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="diabo-button-primary w-full"
          >
            {pending ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Pas encore de compte ?{' '}
          <Link
            href="/signup"
            className="font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
          >
            S&apos;inscrire
          </Link>
        </p>
      </section>
    </main>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeCallbackUrl(value: string | undefined): string {
  if (value?.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}
