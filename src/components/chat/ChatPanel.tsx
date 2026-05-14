'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useDiabo } from '@/components/diabo/DiaboProvider';
import type {
  DiaboMessageMetadata,
  KbCitation,
} from '@/lib/diabo/citations';

type ChatPanelProps = {
  className?: string;
  signedIn?: boolean;
};

/**
 * Sprint-1 chat surface for Diabo.
 *
 * - Uses the AI SDK `useChat` hook with `DefaultChatTransport` pointing at
 *   `/api/chat`.
 * - Drives the Diabo avatar lifecycle from the chat status: `submitted` →
 *   thinking, `streaming` → talking, otherwise idle.
 * - All copy is in French (Maghreb francophone audience per AGENTS.md).
 */
export function ChatPanel({ className, signedIn = false }: ChatPanelProps) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: signedIn ? { chatId: activeChatId } : undefined,
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          const nextChatId = response.headers.get('x-diabo-chat-id');
          if (signedIn && nextChatId) {
            setActiveChatId(nextChatId);
            window.dispatchEvent(
              new CustomEvent('diabo:active-chat-changed', {
                detail: { chatId: nextChatId },
              }),
            );
          }
          return response;
        },
      }),
    [activeChatId, signedIn],
  );

  const { messages, sendMessage, setMessages, status, error, stop, regenerate } =
    useChat({ transport });

  const [input, setInput] = useState('');
  const [hydrating, setHydrating] = useState(true);
  const { setIsThinking, setIsTalking, applyEmotion } = useDiabo();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!signedIn) return;
    const handleSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string | null }>).detail;
      setActiveChatId(detail.chatId);
    };
    window.addEventListener('diabo:chat-selected', handleSelect);
    return () => {
      window.removeEventListener('diabo:chat-selected', handleSelect);
    };
  }, [signedIn]);

  // Hydrate from server on mount so a page refresh keeps the conversation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (signedIn && !activeChatId) {
        setMessages([]);
        setHydrating(false);
        return;
      }
      try {
        setHydrating(true);
        const endpoint =
          signedIn && activeChatId
            ? `/api/chats/${activeChatId}/messages`
            : '/api/chats/current/messages';
        const res = await fetch(endpoint, {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          chatId: string | null;
          messages: Array<{
            id: string;
            role: 'user' | 'assistant';
            parts: Array<{ type: 'text'; text: string }>;
            metadata?: DiaboMessageMetadata;
          }>;
        };
        if (cancelled) return;
        if (data.messages.length > 0) {
          // AI SDK accepts the same UIMessage shape we return on the server.
          setMessages(data.messages as Parameters<typeof setMessages>[0]);
        }
      } catch (err) {
        console.warn('[ChatPanel] hydrate failed:', err);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChatId, setMessages, signedIn]);

  // Drive Diabo lifecycle from chat status.
  useEffect(() => {
    if (status === 'submitted') {
      setIsThinking(true);
      setIsTalking(false);
    } else if (status === 'streaming') {
      setIsThinking(false);
      setIsTalking(true);
    } else {
      setIsThinking(false);
      setIsTalking(false);
    }
  }, [status, setIsThinking, setIsTalking]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const isBusy = status === 'submitted' || status === 'streaming';

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy || hydrating) return;
    sendMessage({ text: trimmed });
    setInput('');
    // Parallel emotion analysis: drives Diabo's face independently of the
    // chat stream. Non-blocking, errors swallowed — Diabo stays put on
    // failure rather than dragging the user down with a broken UI.
    fetch('/api/emotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { label?: string } | null) => {
        if (
          data?.label === 'positive' ||
          data?.label === 'negative' ||
          data?.label === 'neutral'
        ) {
          applyEmotion(data.label);
        }
      })
      .catch((err) => console.warn('[ChatPanel] emotion failed:', err));
  }

  return (
    <section
      className={`flex h-full min-h-[28rem] flex-col rounded-3xl border border-emerald-100/80 bg-white/70 shadow-lg backdrop-blur-md dark:border-emerald-900/40 dark:bg-zinc-900/60 ${className ?? ''}`}
      aria-label="Conversation avec Diabo"
    >
      <header className="flex items-center justify-between border-b border-emerald-100/80 px-5 py-3 dark:border-emerald-900/40">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Discuter avec Diabo
          </h2>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => regenerate()}
            disabled={isBusy}
            className="text-xs font-medium text-emerald-700 transition hover:text-emerald-900 disabled:opacity-40 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            Régénérer
          </button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-5 py-4 text-sm">
        {messages.length === 0 ? (
          hydrating ? <HydratingState /> : <EmptyState />
        ) : (
          messages.map((m, index) => {
            const meta = (m as { metadata?: DiaboMessageMetadata }).metadata;
            const citations =
              m.role === 'assistant' ? meta?.kbCitations : undefined;
            const age = messages.length - 1 - index;
            return (
              <div
                key={m.id}
                className={`space-y-1 transition-opacity duration-500 ${messageOpacityClass(
                  age,
                )}`}
              >
                <Bubble role={m.role}>
                  {m.parts
                    .filter((p) => p.type === 'text')
                    .map((p, i) => (
                      <span key={i}>
                        {(p as { type: 'text'; text: string }).text}
                      </span>
                    ))}
                </Bubble>
                {citations && citations.length > 0 ? (
                  <Citations items={citations} />
                ) : null}
              </div>
            );
          })
        )}
        {status === 'submitted' ? (
          <Bubble role="assistant" pending>
            <TypingDots />
          </Bubble>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Oups — Diabo n&apos;a pas pu répondre : {error.message}
          </p>
        ) : null}
        <div ref={bottomRef} aria-hidden />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-emerald-100/80 px-3 py-3 dark:border-emerald-900/40"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hydrating ? 'Chargement de la conversation…' : "Parle à Diabo… (Comment te sens-tu aujourd'hui ?)"}
          disabled={status === 'error' || hydrating}
          className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          autoComplete="off"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-full bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={input.trim().length === 0 || hydrating}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Envoyer
          </button>
        )}
      </form>
    </section>
  );
}

function messageOpacityClass(ageFromLatest: number): string {
  if (ageFromLatest < 3) return 'opacity-100';
  if (ageFromLatest < 6) return 'opacity-60';
  return 'opacity-30';
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
      <p className="text-sm">
        Bonjour, je suis <span className="font-semibold text-emerald-700 dark:text-emerald-300">Diabo</span>.
      </p>
      <p className="max-w-xs text-xs">
        Pose-moi une question, partage ce que tu ressens, ou demande-moi un conseil pour vivre avec le diabète.
      </p>
    </div>
  );
}

function HydratingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center text-zinc-400 dark:text-zinc-500">
      <span className="inline-flex items-center gap-1.5" aria-label="Chargement">
        <span className="size-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-emerald-400" />
      </span>
      <p className="text-xs">Récupération de votre conversation…</p>
    </div>
  );
}

function Bubble({
  role,
  pending,
  children,
}: {
  role: 'user' | 'assistant' | 'system';
  pending?: boolean;
  children: React.ReactNode;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2 text-sm text-white shadow'
            : `max-w-[80%] rounded-2xl rounded-bl-sm border border-zinc-100 bg-white px-4 py-2 text-sm text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${pending ? 'animate-pulse' : ''}`
        }
      >
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Diabo réfléchit…">
      <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
    </span>
  );
}

/**
 * Renders the RAG citations Diabo consulted to answer the last message.
 * Soft emerald pills under the assistant bubble — informational, not
 * clickable (sprint-9 polish could open the chunk in a side sheet).
 */
function Citations({ items }: { items: KbCitation[] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 pl-1 pt-0.5"
      aria-label="Sources consultées par Diabo"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
        Diabo a consulté ·
      </span>
      {items.map((c) => (
        <span
          key={c.title}
          title={`Pertinence : ${(c.score * 100).toFixed(0)} %`}
          className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          {c.title}
        </span>
      ))}
    </div>
  );
}
