import { getTranslations } from 'next-intl/server';
import {
  ChatInputBar,
  ChatMessages,
  ChatPanel,
} from '@/components/chat/ChatPanel';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { DiaboProvider } from '@/components/diabo/DiaboProvider';
import { HomeDiaboStage } from '@/components/diabo/HomeDiaboStage';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const [session, t] = await Promise.all([auth(), getTranslations('home')]);
  const signedIn = Boolean(session?.user?.id);

  return (
    <DiaboProvider>
      <ChatPanel signedIn={signedIn}>
        <main className="flex h-dvh flex-col bg-gradient-to-b from-emerald-50 via-white to-sky-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
          <header className="px-4 pb-2 pt-6 text-center">
            <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {t('title')}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              {t('subtitle')}
            </p>
          </header>

          <div className="flex flex-1 flex-col items-center overflow-hidden lg:flex-row lg:items-stretch">
            {signedIn ? (
              <div className="hidden lg:block">
                <ConversationSidebar />
              </div>
            ) : null}

            <div className="flex w-full max-w-2xl flex-1 flex-col overflow-hidden px-4 pb-6">
              <div className="flex shrink-0 justify-center py-4">
                <div className="size-[260px] lg:size-[320px]">
                  <HomeDiaboStage />
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-emerald-50/95 to-transparent dark:from-zinc-950/95" />
                <ChatMessages className="h-full" />
              </div>

              <ChatInputBar className="shrink-0 rounded-full border border-zinc-200/80 pb-safe shadow-lg shadow-emerald-950/5 dark:border-zinc-800" />
            </div>
          </div>
        </main>
      </ChatPanel>
    </DiaboProvider>
  );
}
