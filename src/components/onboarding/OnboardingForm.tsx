'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type DiabetesType = '1' | '2' | 'gestational' | 'prediabetes' | 'other';

type CompanionProfilePayload = {
  name?: string;
  diabetesType?: DiabetesType;
  treatment?: string;
  goals?: string[];
  restrictions?: string[];
  city?: string;
};

type CompanionProfileResponse = {
  profile?: CompanionProfilePayload | null;
  error?: string;
};

const DIABETES_TYPES: Array<{ value: DiabetesType; label: string }> = [
  { value: '1', label: 'Type 1' },
  { value: '2', label: 'Type 2' },
  { value: 'gestational', label: 'Gestationnel' },
  { value: 'prediabetes', label: 'Prédiabète' },
  { value: 'other', label: 'Autre' },
];

const TREATMENTS = ['Insuline', 'Metformine', 'Régime seul', 'Autre', 'Aucun'];
const GOALS = [
  'Stabiliser la glycémie',
  'Perdre du poids',
  'Mieux manger',
  'Voyager sereinement',
  'Autre',
];
const RESTRICTIONS = [
  'Halal',
  'Sans gluten',
  'Végétarien',
  'Sans lactose',
  'Aucune',
];

export function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [diabetesType, setDiabetesType] = useState<DiabetesType | ''>('');
  const [city, setCity] = useState('');
  const [treatment, setTreatment] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(
    () => ['Qui es-tu ?', 'Ton traitement', 'Tes préférences'],
    [],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/companion/profile', {
        cache: 'no-store',
      });
      const data = (await response.json()) as CompanionProfileResponse;
      if (!response.ok) {
        throw new Error(data.error ?? 'Chargement impossible');
      }
      if (data.profile) {
        setName(data.profile.name ?? '');
        setDiabetesType(data.profile.diabetesType ?? '');
        setCity(data.profile.city ?? '');
        setTreatment(data.profile.treatment ?? '');
        setGoals(data.profile.goals ?? []);
        setRestrictions(data.profile.restrictions ?? []);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger votre profil',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadProfile]);

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload: CompanionProfilePayload = {
      name: name.trim() || undefined,
      diabetesType: diabetesType || undefined,
      city: city.trim() || undefined,
      treatment: treatment || undefined,
      goals: goals.length > 0 ? goals : undefined,
      restrictions: restrictions.length > 0 ? restrictions : undefined,
    };

    try {
      const response = await fetch('/api/companion/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CompanionProfileResponse;
      if (!response.ok || !data.profile) {
        throw new Error(data.error ?? 'Enregistrement impossible');
      }
      window.localStorage.setItem(
        'diabo_profile',
        JSON.stringify({
          name: name.trim(),
          diabetesType: mapType(diabetesType),
          goal: mapGoal(goals.join(' ')),
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer votre profil",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleValue(
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setter((current) => {
      if (value === 'Aucune') return current.includes(value) ? [] : [value];
      const withoutNone = current.filter((item) => item !== 'Aucune');
      return withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
    });
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Chargement de votre profil...
      </section>
    );
  }

  if (saved) {
    return (
      <section className="space-y-4 rounded-lg border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-zinc-950">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Profil enregistré !
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Diabo se souviendra de toi.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Retour à l&apos;accueil
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={(event) => void submitProfile(event)}
      className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
    >
      <div className="flex items-center justify-center gap-3" aria-label="Étapes">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`h-3 w-3 rounded-full transition ${
              step === index
                ? 'bg-emerald-600 ring-4 ring-emerald-100 dark:ring-emerald-950'
                : 'bg-zinc-300 hover:bg-emerald-300 dark:bg-zinc-700'
            }`}
            aria-label={label}
          />
        ))}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="min-h-[22rem]">
        {step === 0 ? (
          <section className="space-y-5">
            <StepHeader eyebrow="Étape 1" title="Qui es-tu ?" />
            <Field label="Prénom" htmlFor="profile-name">
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Votre prénom"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </Field>
            <Field label="Type de diabète" htmlFor="profile-diabetes-type">
              <select
                id="profile-diabetes-type"
                value={diabetesType}
                onChange={(event) =>
                  setDiabetesType(event.target.value as DiabetesType | '')
                }
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Non précisé</option>
                {DIABETES_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ville" htmlFor="profile-city">
              <input
                id="profile-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={120}
                placeholder="Tunis, Sousse, Alger..."
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </Field>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-5">
            <StepHeader eyebrow="Étape 2" title="Ton traitement" />
            <Field label="Traitement actuel" htmlFor="profile-treatment">
              <select
                id="profile-treatment"
                value={treatment}
                onChange={(event) => setTreatment(event.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Non précisé</option>
                {TREATMENTS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <CheckboxGroup
              legend="Objectifs"
              options={GOALS}
              values={goals}
              onToggle={(value) => toggleValue(value, setGoals)}
            />
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-5">
            <StepHeader
              eyebrow="Étape 3"
              title="Tes préférences alimentaires"
            />
            <CheckboxGroup
              legend="Restrictions"
              options={RESTRICTIONS}
              values={restrictions}
              onToggle={(value) =>
                toggleValue(value, setRestrictions)
              }
            />
          </section>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || saving}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
        >
          Retour
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() =>
              setStep((current) => Math.min(steps.length - 1, current + 1))
            }
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuer
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer mon profil'}
          </button>
        )}
      </div>
    </form>
  );
}

function StepHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckboxGroup({
  legend,
  options,
  values,
  onToggle,
}: {
  legend: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
        {legend}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
              values.includes(option)
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200'
            }`}
          >
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function mapType(value: string | undefined): 't1' | 't2' | 'pre' | 'unknown' {
  if (value === '1') return 't1';
  if (value === '2') return 't2';
  if (value === 'pre' || value === 'prediabetes') return 'pre';
  return 'unknown';
}

function mapGoal(
  challengeText: string,
): 'glucose' | 'restaurants' | 'travel' | 'emotional' {
  const normalized = challengeText.toLowerCase();
  if (
    normalized.includes('restaurant') ||
    normalized.includes('manger') ||
    normalized.includes('aliment')
  ) {
    return 'restaurants';
  }
  if (normalized.includes('voyage') || normalized.includes('hotel')) {
    return 'travel';
  }
  if (
    normalized.includes('emotion') ||
    normalized.includes('stress') ||
    normalized.includes('soutien')
  ) {
    return 'emotional';
  }
  return 'glucose';
}
