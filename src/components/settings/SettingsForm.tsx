'use client';

import { useState } from 'react';
import { Bell, Download, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type SettingsFormProps = {
  signedIn: boolean;
};

const NOTIFICATIONS_KEY = 'diabo_notifications_enabled';

export function SettingsForm({ signedIn }: SettingsFormProps) {
  const t = useTranslations('settings');
  const { setTheme, theme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(NOTIFICATIONS_KEY) === 'true',
  );
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateNotifications(enabled: boolean) {
    setNotificationsEnabled(enabled);
    window.localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  }

  async function deleteConversations() {
    const confirmed = window.confirm(t('deleteConfirm'));
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
        throw new Error(data.error ?? t('deleteError'));
      }
      setMessage(t('deleteSuccess', { count: data.deletedCount ?? 0 }));
      window.dispatchEvent(
        new CustomEvent('diabo:active-chat-changed', {
          detail: { chatId: null },
        }),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('deleteFallbackError'));
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
        throw new Error(data.error ?? t('exportError'));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diabo-data.json';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('downloadFallbackError'));
    } finally {
      setDownloading(false);
    }
  }

  async function enablePushNotifications() {
    if (!signedIn) {
      setMessage(t('signInForNotifications'));
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage(t('pushUnavailable'));
      return;
    }

    setSubscribing(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        updateNotifications(false);
        setMessage(t('permissionDenied'));
        return;
      }

      const keyResponse = await fetch('/api/notifications/subscribe', {
        cache: 'no-store',
      });
      const keyData = (await keyResponse.json()) as {
        publicKey?: string | null;
        error?: string;
      };
      if (!keyResponse.ok || !keyData.publicKey) {
        throw new Error(keyData.error ?? t('pushConfigMissing'));
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const existingSubscription =
        await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(keyData.publicKey),
        }));

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? t('subscribeError'));
      }

      updateNotifications(true);
      setMessage(t('notificationsEnabledMessage'));
    } catch (err) {
      updateNotifications(false);
      setMessage(
        err instanceof Error ? err.message : t('notificationsFallbackError'),
      );
    } finally {
      setSubscribing(false);
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
        title={t('languageTitle')}
        description={t('languageDescription')}
      >
        <LanguageSwitcher />
      </SettingsSection>

      <SettingsSection
        title={t('appearanceTitle')}
        description={t('appearanceDescription')}
      >
        <div className="inline-flex rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
          {[
            { label: t('themeLight'), value: 'light' },
            { label: t('themeDark'), value: 'dark' },
            { label: t('themeSystem'), value: 'system' },
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
        title={t('notificationsTitle')}
        description={t('notificationsDescription')}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex items-center gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) => updateNotifications(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            {t('remindersEnabled')}
          </label>
          <button
            type="button"
            onClick={() => void enablePushNotifications()}
            disabled={!signedIn || subscribing}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200"
          >
            <Bell className="size-4" aria-hidden />
            {subscribing ? t('enablingNotifications') : t('enableNotifications')}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={t('dataTitle')} description={t('dataDescription')}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void downloadData()}
            disabled={!signedIn || downloading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200"
          >
            <Download className="size-4" aria-hidden />
            {downloading ? t('downloading') : t('downloadData')}
          </button>
          <button
            type="button"
            onClick={() => void deleteConversations()}
            disabled={!signedIn || deleting}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            <Trash2 className="size-4" aria-hidden />
            {deleting ? t('deleting') : t('deleteConversations')}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('accountTitle')}
        description={t('accountDescription')}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 opacity-60 dark:border-zinc-800"
          >
            {t('changePassword')}
          </button>
          <button
            type="button"
            disabled
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 opacity-60 dark:border-red-900 dark:text-red-300"
          >
            {t('deleteAccount')}
          </button>
        </div>
      </SettingsSection>
    </section>
  );
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output.buffer;
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
