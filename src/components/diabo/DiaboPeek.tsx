'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  ChatInputBar,
  ChatMessages,
  ChatPanel,
} from '@/components/chat/ChatPanel';
import { DiaboStage } from '@/components/diabo/DiaboStage';
import { useDiaboLook } from '@/hooks/useDiaboLook';

export function DiaboPeek({
  signedIn,
  userId,
}: {
  signedIn: boolean;
  userId?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <>
      <DiaboPeekButton
        chatOpen={chatOpen}
        visible={visible}
        onToggleChat={() => setChatOpen((value) => !value)}
      />
      {chatOpen ? (
        <FloatingChatPanel
          signedIn={signedIn}
          userId={userId}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
    </>
  );
}

function DiaboPeekButton({
  chatOpen,
  onToggleChat,
  visible,
}: {
  chatOpen: boolean;
  onToggleChat: () => void;
  visible: boolean;
}) {
  const containerRef = useRef<HTMLButtonElement>(null);
  useDiaboLook(containerRef);

  return (
    <button
      type="button"
      ref={containerRef}
      onClick={onToggleChat}
      className={`fixed bottom-0 right-4 z-[65] overflow-hidden rounded-t-2xl transition-[height,width,transform,opacity] duration-500 ease-out focus:outline-none ${
        chatOpen
          ? 'h-64 w-56 translate-y-0'
          : `h-10 w-36 ${visible ? 'translate-y-0' : 'translate-y-full'}`
      }`}
      aria-label={
        chatOpen ? 'Fermer la conversation avec Diabo' : 'Afficher Diabo'
      }
      aria-expanded={chatOpen}
    >
      <DiaboStage className="absolute inset-x-0 top-0 h-64 w-full" />
    </button>
  );
}

function FloatingChatPanel({
  onClose,
  signedIn,
  userId,
}: {
  onClose: () => void;
  signedIn: boolean;
  userId?: string;
}) {
  return (
    <div className="fixed bottom-4 right-[calc(14rem+1rem)] z-[70] w-[min(24rem,calc(100vw-16rem))] min-w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20 dark:border-zinc-800 dark:bg-zinc-950">
      <ChatPanel signedIn={signedIn} userId={userId}>
        <section
          className="flex h-[min(28rem,calc(100dvh-2rem))] flex-col"
          aria-label="Chat flottant avec Diabo"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Diabo
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Assistant santé
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              aria-label="Fermer le chat"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <ChatMessages className="min-h-0" />
          <ChatInputBar className="shrink-0" />
        </section>
      </ChatPanel>
    </div>
  );
}
