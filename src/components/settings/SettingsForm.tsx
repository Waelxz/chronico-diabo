'use client';

import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type SettingsFormProps = {
  signedIn: boolean;
};

const NOTIFICATIONS_KEY = 'diabo_notifications_enabled';

export function SettingsForm({ signedIn }: SettingsFormProps) {
  const { setTheme, theme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(NOTIFICATIONS_KEY) === 'true',
  );
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateNotifications(enabled: boolean) {
    setNotificationsEnabled(enabled);
    window.localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  }

  async function deleteConversations() {
    const confirmed = window.confirm(
      'Supprimer toutes vos conversations enregistrées ? Cette action est définitive.',
    );
    if (!confirmed) return;

    setDeleting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/settings/conversations', {
        method: 'DELETE',
      });
      const data = (await response.json()) as {
        deletedCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? 'Suppression impossible');
      }
      setMessage(`${data.deletedCount ?? 0} conversation(s) supprimée(s).`);
      window.dispatchEvent(
        new CustomEvent('diabo:active-chat-changed', {
          detail: { chatId: null },
        }),
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Impossible de supprimer les conversations',
      );
    } finally {
      setDeleting(false);
    }
  }

  async function downloadData() {
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/settings/export');
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Export impossible');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diabo-data.json';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Impossible de télécharger les données',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      <SettingsSection
        title="Langue"
        description="Choisis la langue de l'interface."
      >
        <LanguageSwitcher />
      </SettingsSection>

      <SettingsSection
        title="Apparence"
        description="Sélectionne le thème visuel de Diabo."
      >
        <div className="inline-flex rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
          {[
            { label: 'Clair', value: 'light' },
            { label: 'Sombre', value: 'dark' },
            { label: 'Système', value: 'system' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                theme === option.value
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Active ou désactive les rappels envoyés par Diabo."
      >
        <label className="inline-flex items-center gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(event) => updateNotifications(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          Rappels activés
        </label>
      </SettingsSection>

      <SettingsSection
        title="Données"
        description="Télécharge tes données ou nettoie l'historique des conversations."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void downloadData()}
            disabled={!signedIn || downloading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200"
          >
            <Download className="size-4" aria-hidden />
            {downloading ? 'Téléchargement...' : 'Télécharger mes données'}
          </button>
          <button
            type="button"
            onClick={() => void deleteConversations()}
            disabled={!signedIn || deleting}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            <Trash2 className="size-4" aria-hidden />
            {deleting ? 'Suppression...' : 'Supprimer les conversations'}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Compte"
        description="Options de sécurité et de suppression du compte."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 opacity-60 dark:border-zinc-800"
          >
            Changer le mot de passe
          </button>
          <button
            type="button"
            disabled
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 opacity-60 dark:border-red-900 dark:text-red-300"
          >
            Supprimer le compte
          </button>
        </div>
      </SettingsSection>
    </section>
  );
}

function SettingsSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid gap-3 border-b border-zinc-100 pb-5 last:border-0 last:pb-0 dark:border-zinc-800 md:grid-cols-[14rem_1fr]">
      <div>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <div>{children}</div>
    </section>
  );
}
