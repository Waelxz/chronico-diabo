import { ChatPanel } from '@/components/chat/ChatPanel';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { DiaboProvider } from '@/components/diabo/DiaboProvider';
import { DiaboStage } from '@/components/diabo/DiaboStage';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col bg-gradient-to-b from-emerald-50 via-white to-sky-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <DiaboProvider>
        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-6 py-10 lg:min-h-[34rem] lg:py-12">
          <div
            className={`grid w-full grid-cols-1 gap-8 ${
              signedIn
                ? 'lg:grid-cols-[18rem_0.9fr_1.05fr]'
                : 'lg:grid-cols-[1fr_1.05fr]'
            } lg:items-stretch`}
          >
            {signedIn ? <ConversationSidebar /> : null}
            <div className="flex items-center justify-center">
              <div className="relative aspect-square w-full max-w-md">
                <DiaboStage className="absolute inset-0 h-full w-full" />
              </div>
            </div>
            <ChatPanel className="w-full" signedIn={signedIn} />
          </div>
        </div>
      </DiaboProvider>
    </section>
  );
}
