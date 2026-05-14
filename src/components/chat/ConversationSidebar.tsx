'use client';

import { useCallback, useEffect, useState } from 'react';

type ChatListItem = {
  id: string;
  preview: string;
  updatedAt: string;
};

export function ConversationSidebar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
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

  return (
    <aside className="lg:w-72">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-3 inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm lg:hidden"
        aria-expanded={open}
      >
        Conversations
      </button>

      <div
        className={`${
          open ? 'block' : 'hidden'
        } rounded-lg border border-zinc-200 bg-zinc-50 p-3 shadow-sm lg:block dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <button
          type="button"
          onClick={() => selectChat(null)}
          className="mb-3 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Nouvelle conversation
        </button>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          {loading ? (
            <p className="px-2 py-3 text-sm text-zinc-500">
              Chargement des conversations...
            </p>
          ) : chats.length === 0 ? (
            <p className="px-2 py-3 text-sm text-zinc-500">
              Aucune conversation enregistrée.
            </p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => selectChat(chat.id)}
                className={`w-full rounded-md px-3 py-2 text-left transition ${
                  activeChatId === chat.id
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                    : 'text-zinc-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="block truncate text-sm font-medium">
                  {chat.preview}
                </span>
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  {relativeDate(chat.updatedAt)}
                </span>
              </button>
            ))
          )}
        </div>
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
