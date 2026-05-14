'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, Square } from 'lucide-react';
import { useDiabo } from '@/components/diabo/DiaboProvider';
import type {
  DiaboMessageMetadata,
  KbCitation,
} from '@/lib/diabo/citations';

type ChatPanelProps = {
  children?: ReactNode;
  className?: string;
  signedIn?: boolean;
};

type ChatMessage = ReturnType<typeof useChat>['messages'][number];
type ChatStatus = ReturnType<typeof useChat>['status'];

type ChatContextValue = {
  error: Error | undefined;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  hydrating: boolean;
  input: string;
  isBusy: boolean;
  messages: ChatMessage[];
  regenerate: () => void;
  setInput: (value: string) => void;
  status: ChatStatus;
  stop: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Chat state shell for Diabo.
 *
 * The AI SDK transport, conversation hydration and avatar lifecycle stay here.
 * The visual pieces are exported separately so pages can place messages, avatar
 * and input without duplicating chat logic.
 */
export function ChatPanel({
  children,
  className,
  signedIn = false,
}: ChatPanelProps) {
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
  const isBusy = status === 'submitted' || status === 'streaming';

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

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy || hydrating) return;
    sendMessage({ text: trimmed });
    setInput('');

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
  }, [applyEmotion, hydrating, input, isBusy, sendMessage]);

  const value = useMemo<ChatContextValue>(
    () => ({
      error,
      handleSubmit,
      hydrating,
      input,
      isBusy,
      messages,
      regenerate,
      setInput,
      status,
      stop,
    }),
    [
      error,
      handleSubmit,
      hydrating,
      input,
      isBusy,
      messages,
      regenerate,
      status,
      stop,
    ],
  );

  return (
    <ChatContext.Provider value={value}>
      {children ?? (
        <section
          className={`flex flex-1 flex-col rounded-3xl border border-emerald-100/80 bg-white/70 shadow-lg backdrop-blur-md dark:border-emerald-900/40 dark:bg-zinc-900/60 ${className ?? ''}`}
          aria-label="Conversation avec Diabo"
        >
          <ChatHeader />
          <ChatMessages />
          <ChatInputBar />
        </section>
      )}
    </ChatContext.Provider>
  );
}

export function ChatMessages({ className }: { className?: string }) {
  const { messages, status, error, hydrating } = useChatContext();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  return (
    <div
      className={`flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4 text-sm ${className ?? ''}`}
      aria-live="polite"
    >
      {messages.length === 0 ? (
        hydrating ? (
          <HydratingState />
        ) : (
          <EmptyState />
        )
      ) : (
        messages.map((m) => {
          const meta = (m as { metadata?: DiaboMessageMetadata }).metadata;
          const citations =
            m.role === 'assistant' ? meta?.kbCitations : undefined;
          return (
            <MessageRow
              key={m.id}
              role={m.role}
              text={m.parts
                .filter((p) => p.type === 'text')
                .map((p) => (p as { type: 'text'; text: string }).text)
                .join('\n')}
              citations={citations}
            />
          );
        })
      )}
      {status === 'submitted' ? (
        <AssistantRow>
          <TypingDots />
        </AssistantRow>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Oups, Diabo n&apos;a pas pu répondre : {error.message}
        </p>
      ) : null}
      <div ref={sentinelRef} className="h-0" aria-hidden />
    </div>
  );
}

export function ChatInputBar({ className }: { className?: string }) {
  const { handleSubmit, hydrating, input, isBusy, setInput, status, stop } =
    useChatContext();

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full items-center gap-2 border-t border-zinc-200/80 bg-white/90 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/90 ${className ?? ''}`}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={hydrating ? 'Chargement de la conversation...' : 'Écris quelque chose...'}
        disabled={status === 'error' || hydrating}
        className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 transition-transform duration-150 focus:scale-[1.01] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        autoComplete="off"
      />
      {isBusy ? (
        <button
          type="button"
          onClick={() => stop()}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white transition-all duration-150 hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
          aria-label="Arrêter la réponse"
        >
          <Square className="size-4 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={input.trim().length === 0 || hydrating}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white transition-all duration-150 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          aria-label="Envoyer"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      )}
    </form>
  );
}

function ChatHeader() {
  const { messages, isBusy, regenerate } = useChatContext();

  return (
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
          className="text-xs font-medium text-emerald-700 transition-all duration-150 hover:text-emerald-900 disabled:opacity-40 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          Régénérer
        </button>
      ) : null}
    </header>
  );
}

function MessageRow({
  citations,
  role,
  text,
}: {
  citations?: KbCitation[];
  role: ChatMessage['role'];
  text: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] rounded-2xl rounded-br-none bg-zinc-800 px-4 py-2.5 text-sm leading-6 text-white">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AssistantRow>{renderMarkdownLite(text)}</AssistantRow>
      {citations && citations.length > 0 ? <Citations items={citations} /> : null}
    </div>
  );
}

function AssistantRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-[82%] items-start gap-2 text-zinc-900 dark:text-zinc-100">
      <span className="mt-1 grid size-3 shrink-0 place-items-center rounded-full bg-emerald-500 text-[7px] font-bold leading-none text-white">
        D
      </span>
      <div className="min-w-0 text-sm leading-6">{children}</div>
    </div>
  );
}

function renderMarkdownLite(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g);
  return parts.map((part, index) => {
    if (part === '\n') return <br key={index} />;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
      <p className="text-sm">
        Bonjour, je suis{' '}
        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
          Diabo
        </span>
        .
      </p>
      <p className="max-w-xs text-xs">
        Pose-moi une question, partage ce que tu ressens, ou demande-moi un
        conseil pour vivre avec le diabète.
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
      <p className="text-xs">Récupération de votre conversation...</p>
    </div>
  );
}

function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label="Diabo réfléchit..."
    >
      <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
    </span>
  );
}

function Citations({ items }: { items: KbCitation[] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 pl-5 pt-0.5"
      aria-label="Sources consultées par Diabo"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
        Diabo a consulté ·
      </span>
      {items.map((c) => (
        <span
          key={c.title}
          title={`Pertinence : ${(c.score * 100).toFixed(0)} %`}
          className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          {c.title}
        </span>
      ))}
    </div>
  );
}

function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('ChatMessages and ChatInputBar must be used inside ChatPanel');
  }
  return ctx;
}
