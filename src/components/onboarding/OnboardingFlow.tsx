'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type DiabetesType = 't1' | 't2' | 'pre' | 'unknown';
type Goal = 'glucose' | 'restaurants' | 'travel' | 'emotional';

type OnboardingProfile = {
  diabetesType: DiabetesType;
  goal: Goal;
  name: string;
};

const PROFILE_KEY = 'diabo_profile';
const ANON_ID_KEY = 'diabo_anon_id';

const DIABETES_OPTIONS: Array<{ value: DiabetesType; label: string }> = [
  { value: 't1', label: 'Type 1' },
  { value: 't2', label: 'Type 2' },
  { value: 'pre', label: 'Pré-diabète' },
  { value: 'unknown', label: 'Je ne sais pas encore' },
];

const GOAL_OPTIONS: Array<{ value: Goal; label: string }> = [
  { value: 'glucose', label: 'Mieux gérer ma glycémie' },
  { value: 'restaurants', label: 'Trouver des restaurants adaptés' },
  { value: 'travel', label: 'Planifier mes voyages' },
  { value: 'emotional', label: 'Soutien émotionnel au quotidien' },
];

export function OnboardingFlow() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const homePath = `/${params.locale ?? ''}`;
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [diabetesType, setDiabetesType] = useState<DiabetesType | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(PROFILE_KEY)) {
      router.push(homePath);
      return;
    }
    let frame = 0;
    const timeout = window.setTimeout(() => {
      setMounted(true);
      frame = window.requestAnimationFrame(() => setEntered(true));
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
    };
  }, [homePath, router]);

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!diabetesType || !goal || !name.trim() || saving) return;

    setSaving(true);
    const profile: OnboardingProfile = {
      diabetesType,
      goal,
      name: name.trim(),
    };

    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anon-id': getAnonId(),
        },
        body: JSON.stringify(profile),
      });
    } catch (err) {
      console.warn('[OnboardingFlow] profile sync failed:', err);
    } finally {
      router.push(homePath);
    }
  }

  if (!mounted) return null;

  return (
    <form
      onSubmit={(event) => void submitProfile(event)}
      className={`w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-emerald-950/5 transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7 ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="mb-6 flex flex-col items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-emerald-600 text-xl font-bold text-white">
          D
        </div>
        <div className="flex items-center gap-2" aria-label="Progression">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`size-2.5 rounded-full transition-all duration-300 ${
                step === index
                  ? 'bg-emerald-600'
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div
        key={step}
        className="min-h-[18rem] translate-y-0 opacity-100 transition-all duration-300"
      >
        {step === 0 ? (
          <Step title="Quel est ton type de diabète ?">
            <OptionGroup
              name="diabetes-type"
              options={DIABETES_OPTIONS}
              value={diabetesType}
              onChange={setDiabetesType}
            />
          </Step>
        ) : null}

        {step === 1 ? (
          <Step title="Quel est ton principal objectif avec Diabo ?">
            <OptionGroup
              name="goal"
              options={GOAL_OPTIONS}
              value={goal}
              onChange={setGoal}
            />
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title="Comment Diabo peut-il t'appeler ?">
            <label className="block space-y-2">
              <span className="sr-only">Ton prénom ou surnom</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Ton prénom ou surnom"
                className="w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition-all duration-300 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                autoComplete="given-name"
              />
            </label>
          </Step>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={saving}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-all duration-300 hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
          >
            Retour
          </button>
        ) : (
          <span />
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(2, current + 1))}
            disabled={(step === 0 && !diabetesType) || (step === 1 && !goal)}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuer
          </button>
        ) : (
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Commencer avec Diabo'}
          </button>
        )}
      </div>
    </form>
  );
}

function Step({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-5">
      <h1 className="text-center text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h1>
      {children}
    </section>
  );
}

function OptionGroup<T extends string>({
  name,
  onChange,
  options,
  value,
}: {
  name: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T | null;
}) {
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-4 py-3 text-left text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
              selected
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200'
            }`}
            aria-pressed={selected}
          >
            <span className="sr-only">{name}: </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getAnonId(): string {
  const existing = window.localStorage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  const next =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(ANON_ID_KEY, next);
  return next;
}
