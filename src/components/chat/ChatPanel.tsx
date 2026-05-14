'use client';

import {
  createContext,
  memo,
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
import type { DiaboMessageMetadata } from '@/lib/diabo/citations';

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
        headers: () => ({
          'x-diabo-profile':
            typeof window !== 'undefined'
              ? (localStorage.getItem('diabo_profile') ?? '')
              : '',
          'x-anon-id':
            typeof window !== 'undefined'
              ? (localStorage.getItem('diabo_anon_id') ?? '')
              : '',
        }),
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
  const previousStatusRef = useRef<ChatStatus>(status);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const becameIdle =
      previousStatusRef.current !== 'ready' && status === 'ready';
    const behavior: ScrollBehavior =
      reducedMotion || !becameIdle ? 'instant' : 'smooth';

    sentinelRef.current?.scrollIntoView({ behavior, block: 'end' });
    previousStatusRef.current = status;
  }, [messages, status]);

  const lastUserText = useMemo(() => {
    const latestUserMessage = messages.findLast(
      (message) => message.role === 'user',
    );
    return latestUserMessage
      ? latestUserMessage.parts
          .filter(
            (part): part is { type: 'text'; text: string } =>
              part.type === 'text',
          )
          .map((part) => part.text)
          .join('\n')
      : '';
  }, [messages]);

  const showSafetyBanner = containsSafetyKeyword(lastUserText);

  return (
    <div
      className={`flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4 text-base ${className ?? ''}`}
      aria-live="polite"
    >
      {showSafetyBanner ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Si c est urgent ou severe, contacte les urgences locales ou ton
          medecin. Diabo ne remplace pas un avis medical.
        </div>
      ) : null}
      {messages.length === 0 ? (
        hydrating ? (
          <HydratingState />
        ) : (
          <EmptyState />
        )
      ) : (
        messages.map((m) => {
          return (
            <MessageRow
              key={m.id}
              role={m.role}
              text={m.parts
                .filter((p) => p.type === 'text')
                .map((p) => (p as { type: 'text'; text: string }).text)
                .join('\n')}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback((element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      resizeTextarea(textareaRef.current);
    }
  }, [input, resizeTextarea]);

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full items-center gap-2 border-t border-zinc-200/80 bg-white/90 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/90 ${className ?? ''}`}
    >
      <textarea
        ref={textareaRef}
        aria-label="Ecrire un message a Diabo"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          resizeTextarea(e.target);
        }}
        onKeyDown={(event) => {
          const isMobile =
            typeof navigator !== 'undefined' && navigator.maxTouchPoints >= 2;
          if (event.key === 'Enter' && !event.shiftKey && !isMobile) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={hydrating ? 'Chargement de la conversation...' : 'Écris quelque chose...'}
        disabled={status === 'error' || hydrating}
        rows={1}
        className="max-h-[7rem] min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-3xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 transition-transform duration-150 focus:scale-[1.01] focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
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
  role,
  text,
}: {
  role: ChatMessage['role'];
  text: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-none bg-zinc-800 px-4 py-3 text-base leading-7 text-white">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AssistantRow>{renderMarkdownLite(text)}</AssistantRow>
    </div>
  );
}

const AssistantRow = memo(function AssistantRow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex max-w-[88%] items-start gap-2.5 text-zinc-900 dark:text-zinc-100">
      <span className="mt-1.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-emerald-500 text-[7px] font-bold leading-none text-white">
        D
      </span>
      <div className="min-w-0 text-base leading-7">{children}</div>
    </div>
  );
});

function renderMarkdownLite(text: string): ReactNode {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      nodes.push(
        <hr key={i} className="my-2 border-zinc-200 dark:border-zinc-700" />,
      );
      i++;
      continue;
    }

    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      nodes.push(
        <p key={i} className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">
          {renderInline(h2[1])}
        </p>,
      );
      i++;
      continue;
    }

    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      nodes.push(
        <p key={i} className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">
          {renderInline(h3[1])}
        </p>,
      );
      i++;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const content = lines[i].replace(/^[-*]\s/, '');
        items.push(
          <li key={i} className="ml-3 list-disc">
            {renderInline(content)}
          </li>,
        );
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-2">
          {items}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const content = lines[i].replace(/^\d+\.\s/, '');
        items.push(
          <li key={i} className="ml-3 list-decimal">
            {renderInline(content)}
          </li>,
        );
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5 pl-2">
          {items}
        </ol>,
      );
      continue;
    }

    nodes.push(
      <p key={i} className="leading-6">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function EmptyState() {
  const { setInput } = useChatContext();
  const prompts = [
    'Que manger ce soir ?',
    'J ai une hypo, que faire ?',
    'Trouve un restaurant a Tunis',
    'Resumez ma semaine glycemie',
  ];

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
      <div className="mt-3 flex max-w-md flex-wrap justify-center gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="rounded-full border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700 transition-all hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            {prompt}
          </button>
        ))}
      </div>
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

function containsSafetyKeyword(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    'perte de conscience',
    'douleur thoracique',
    'vomissement',
    'respiration rapide',
    'acidocetose',
    'hypoglycemie severe',
    'malaise severe',
  ].some((keyword) => normalized.includes(keyword));
}


function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('ChatMessages and ChatInputBar must be used inside ChatPanel');
  }
  return ctx;
}
