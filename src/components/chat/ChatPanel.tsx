'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useDiabo } from '@/components/diabo/DiaboProvider';

type ChatPanelProps = {
  className?: string;
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
export function ChatPanel({ className }: ChatPanelProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
  });

  const [input, setInput] = useState('');
  const { setIsThinking, setIsTalking } = useDiabo();
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const isBusy = status === 'submitted' || status === 'streaming';

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput('');
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

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => (
            <Bubble key={m.id} role={m.role}>
              {m.parts
                .filter((p) => p.type === 'text')
                .map((p, i) => (
                  <span key={i}>{(p as { type: 'text'; text: string }).text}</span>
                ))}
            </Bubble>
          ))
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
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-emerald-100/80 px-3 py-3 dark:border-emerald-900/40"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Parle à Diabo… (Comment te sens-tu aujourd'hui ?)"
          disabled={status === 'error'}
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
            disabled={input.trim().length === 0}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Envoyer
          </button>
        )}
      </form>
    </section>
  );
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
