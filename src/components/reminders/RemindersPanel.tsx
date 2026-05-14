'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { Info } from 'lucide-react';

type ReminderType =
  | 'medication'
  | 'glucose'
  | 'exercise'
  | 'hydration'
  | 'custom';

type Reminder = {
  _id: string;
  label: string;
  cronExpr: string;
  type: ReminderType;
  enabled: boolean;
  createdAt: string;
};

type SessionResponse = {
  user?: { id?: string; name?: string | null; email?: string | null };
} | null;

const TYPE_LABELS: Record<ReminderType, string> = {
  medication: 'Médicament',
  glucose: 'Glycémie',
  exercise: 'Exercice',
  hydration: 'Hydratation',
  custom: 'Autre',
};

const QUICK_REMINDERS: Array<{
  label: string;
  time: string;
  type: ReminderType;
}> = [
  { label: 'Medicament', time: '08:00', type: 'medication' },
  { label: 'Glycemie', time: '07:30', type: 'glucose' },
  { label: 'Hydratation', time: '12:00', type: 'hydration' },
];

export function RemindersPanel() {
  const [session, setSession] = useState<SessionResponse>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ReminderType>('medication');
  const [time, setTime] = useState('08:00');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const signedIn = Boolean(session?.user?.id);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/reminders', { cache: 'no-store' });
      const data = (await response.json()) as {
        reminders?: Reminder[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? 'Chargement impossible');
      }
      setReminders(data.reminders ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les rappels',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = (await response.json()) as SessionResponse;
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const timeoutId = window.setTimeout(() => {
      void loadReminders();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadReminders, signedIn]);

  const enabledCount = useMemo(
    () => reminders.filter((reminder) => reminder.enabled).length,
    [reminders],
  );

  async function submitReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          type,
          enabled: true,
          cronExpr: timeToCron(time),
        }),
      });
      const data = (await response.json()) as {
        reminder?: Reminder;
        error?: string;
      };
      if (!response.ok || !data.reminder) {
        throw new Error(data.error ?? 'Enregistrement impossible');
      }
      setReminders((current) => [data.reminder as Reminder, ...current]);
      setLabel('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible d'ajouter le rappel",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(reminder: Reminder) {
    setError(null);
    const nextEnabled = !reminder.enabled;
    setReminders((current) =>
      current.map((item) =>
        item._id === reminder._id ? { ...item, enabled: nextEnabled } : item,
      ),
    );
    try {
      const response = await fetch(`/api/reminders/${reminder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!response.ok) {
        throw new Error('Mise à jour impossible');
      }
    } catch (err) {
      setReminders((current) =>
        current.map((item) =>
          item._id === reminder._id
            ? { ...item, enabled: reminder.enabled }
            : item,
        ),
      );
      setError(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  }

  async function deleteReminder(id: string) {
    setError(null);
    const previous = reminders;
    setReminders((current) => current.filter((item) => item._id !== id));
    try {
      const response = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Suppression impossible');
      }
    } catch (err) {
      setReminders(previous);
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    }
  }

  async function subscribeToPush() {
    setPushLoading(true);
    setPushStatus(null);
    setError(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Notifications non prises en charge par ce navigateur');
      }
      const keyResponse = await fetch('/api/push/subscribe');
      const keyData = (await keyResponse.json()) as { publicKey?: string | null };
      if (!keyData.publicKey) {
        throw new Error('Clé VAPID manquante côté serveur');
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Autorisation de notification refusée');
      }
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        }));
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
      if (!response.ok) {
        throw new Error('Activation des notifications impossible');
      }
      setPushStatus('Notifications activées pour vos rappels.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’activer les notifications',
      );
    } finally {
      setPushLoading(false);
    }
  }

  function applyQuickReminder(reminder: (typeof QUICK_REMINDERS)[number]) {
    setLabel(reminder.label);
    setTime(reminder.time);
    setType(reminder.type);
  }

  if (checkingSession) {
    return <PanelState text="Vérification de la session..." />;
  }

  if (!signedIn) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Connectez-vous pour activer les rappels
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Les rappels et notifications sont liés à votre compte pour rester
          disponibles entre vos appareils.
        </p>
        <button
          type="button"
          onClick={() => void signIn('google')}
          className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Se connecter
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              Mes rappels
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {enabledCount} rappel{enabledCount > 1 ? 's' : ''} actif
              {enabledCount > 1 ? 's' : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void subscribeToPush()}
            disabled={pushLoading}
            className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            {pushLoading ? 'Activation...' : 'Activer les notifications'}
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Les notifications navigateur sont enregistrees localement. Un
            serveur de planification est necessaire pour l envoi automatique.
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}
        {pushStatus ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            {pushStatus}
          </p>
        ) : null}

        {loading ? (
          <PanelState text="Chargement des rappels..." />
        ) : reminders.length === 0 ? (
          <PanelState text="Aucun rappel enregistré." />
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <article
                key={reminder._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-zinc-950 dark:text-zinc-50">
                      {reminder.label}
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {TYPE_LABELS[reminder.type]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {cronToTime(reminder.cronExpr)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleReminder(reminder)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      reminder.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {reminder.enabled ? 'Activé' : 'Désactivé'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteReminder(reminder._id)}
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <form
        onSubmit={(event) => void submitReminder(event)}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Ajouter un rappel
        </h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_REMINDERS.map((reminder) => (
            <button
              key={`${reminder.label}-${reminder.time}`}
              type="button"
              onClick={() => applyQuickReminder(reminder)}
              className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              {reminder.label} {reminder.time}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <label htmlFor="reminder-label" className="text-sm font-medium">
            Libellé
          </label>
          <input
            id="reminder-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={120}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reminder-type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="reminder-type"
            value={type}
            onChange={(event) => setType(event.target.value as ReminderType)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Object.entries(TYPE_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="reminder-time" className="text-sm font-medium">
            Heure
          </label>
          <input
            id="reminder-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? 'Enregistrement...' : 'Ajouter'}
        </button>
      </form>
    </div>
  );
}

function PanelState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      {text}
    </div>
  );
}

function timeToCron(value: string): string {
  const [hour = '8', minute = '0'] = value.split(':');
  return `${Number(minute)} ${Number(hour)} * * *`;
}

function cronToTime(value: string): string {
  const parts = value.split(' ');
  const minute = parts[0]?.padStart(2, '0') ?? '00';
  const hour = parts[1]?.padStart(2, '0') ?? '08';
  return `${hour}:${minute}`;
}

function urlBase64ToUint8Array(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return buffer;
}
