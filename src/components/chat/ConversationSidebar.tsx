'use client';

import { Languages } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type ChatListItem = {
  id: string;
  preview: string;
  updatedAt: string;
};

type TranslatedMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  metadata?: Record<string, unknown>;
};

export function ConversationSidebar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/chats', { cache: 'no-store' });
      const data = (await response.json()) as {
        chats?: ChatListItem[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? 'Chargement impossible');
      }
      const nextChats = data.chats ?? [];
      setChats(nextChats);
      setActiveChatId((current) => {
        if (current && nextChats.some((chat) => chat.id === current)) {
          return current;
        }
        const firstChatId = nextChats[0]?.id ?? null;
        if (firstChatId) selectChat(firstChatId);
        return firstChatId;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les conversations',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadChats();
    }, 0);
    const handleChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string }>).detail;
      setActiveChatId(detail.chatId);
      void loadChats();
    };
    window.addEventListener('diabo:active-chat-changed', handleChanged);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('diabo:active-chat-changed', handleChanged);
    };
  }, [loadChats]);

  function selectChat(chatId: string | null) {
    setActiveChatId(chatId);
    window.dispatchEvent(
      new CustomEvent('diabo:chat-selected', { detail: { chatId } }),
    );
    setOpen(false);
  }

  async function translateChat(chatId: string) {
    setTranslatingId(chatId);
    setError(null);
    try {
      const response = await fetch('/api/chat/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, targetLanguage: 'ar' }),
      });
      const data = (await response.json()) as {
        messages?: TranslatedMessage[];
        error?: string;
      };
      if (!response.ok || !data.messages) {
        throw new Error(data.error ?? 'Traduction impossible');
      }
      setActiveChatId(chatId);
      window.dispatchEvent(
        new CustomEvent('diabo:chat-translated', {
          detail: { chatId, messages: data.messages },
        }),
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Traduction impossible');
    } finally {
      setTranslatingId(null);
    }
  }

  if (!loading && chats.length === 0) {
    return null;
  }

  return (
    <aside className="lg:w-72 lg:shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed right-4 top-4 z-40 inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-all duration-150 lg:hidden"
        aria-expanded={open}
      >
        Conversations
      </button>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-zinc-950/40 lg:hidden"
          aria-label="Fermer les conversations"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={`${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } fixed bottom-0 right-0 top-0 z-40 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-3 shadow-2xl transition-transform duration-300 lg:static lg:block lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-lg lg:border lg:shadow-sm dark:border-zinc-800 dark:bg-zinc-950`}
      >
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {loading || chats.length > 0 ? (
          <div className="space-y-2">
            {loading ? (
              <p className="px-2 py-3 text-sm text-zinc-500">
                Chargement des conversations...
              </p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`w-full rounded-md px-3 py-2 text-left transition-all duration-150 ${
                    activeChatId === chat.id
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                      : 'text-zinc-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => selectChat(chat.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium">
                        {chat.preview}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                        {relativeDate(chat.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void translateChat(chat.id)}
                      disabled={translatingId === chat.id}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition-all duration-150 hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
                      aria-label="Traduire en arabe"
                      title="Traduire en arabe"
                    >
                      <Languages className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function relativeDate(value: string): string {
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return 'Date inconnue';
  const diffMs = Date.now() - date;
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}
