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

          <div className="flex flex-1 overflow-hidden">
            {signedIn ? <ConversationSidebar /> : null}

            {/* Mobile: avatar on top, messages+input below */}
            {/* Desktop (lg+): avatar fixed left, messages+input take remaining space */}
            <div className="flex min-w-0 flex-1 flex-col lg:flex-row">

              {/* Avatar column — centered on mobile (above chat), left panel on desktop */}
              <div className="flex shrink-0 items-center justify-center px-4 pb-2 pt-4 lg:w-64 lg:flex-col lg:justify-center lg:pb-8 lg:pt-0 xl:w-80">
                <div className="size-[160px] sm:size-[200px] lg:size-[240px] xl:size-[280px]">
                  <HomeDiaboStage />
                </div>
              </div>

              {/* Chat column — messages scroll, input pinned at bottom */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 pb-6 lg:px-0 lg:pr-6">
                <ChatMessages className="w-full flex-1" />
                <ChatInputBar className="mt-3 rounded-full border border-zinc-200/80 shadow-lg shadow-emerald-950/5 dark:border-zinc-800" />
              </div>

            </div>
          </div>
        </main>
      </ChatPanel>
    </DiaboProvider>
  );
}
