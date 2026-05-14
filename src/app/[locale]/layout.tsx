import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { auth, signIn, signOut } from '@/lib/auth';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Diabo — votre compagnon IA',
    template: '%s · Diabo',
  },
  description:
    "Diabo est un compagnon IA empathique pour les personnes vivant avec le diabète. Suivi, soutien émotionnel, recommandations adaptées au quotidien (FR / AR).",
  applicationName: 'Diabo',
  keywords: ['diabète', 'compagnon IA', 'santé', 'empathie', 'Maghreb', 'Tunisie'],
  authors: [{ name: 'Chronico — équipe M1 Big Data IHEC' }],
  openGraph: {
    title: 'Diabo — votre compagnon IA',
    description:
      'Compagnon IA empathique pour le diabète au quotidien. Conçu pour le Maghreb francophone.',
    locale: 'fr_FR',
    type: 'website',
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = await params.then((p) => p.locale);
  if (!routing.locales.includes(locale as 'fr' | 'ar')) {
    notFound();
  }
  const [messages, session, t] = await Promise.all([
    getMessages(),
    auth(),
    getTranslations('nav'),
  ]);

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider messages={messages}>
          <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
              <Link
                href="/"
                className="text-sm font-semibold text-emerald-700 dark:text-emerald-400"
              >
                {t('home')}
              </Link>
              <NavLink href="/restaurants">{t('restaurants')}</NavLink>
              <NavLink href="/hotels">{t('hotels')}</NavLink>
              <NavLink href="/glucose">{t('glucose')}</NavLink>
              <NavLink href="/onboarding">{t('profile')}</NavLink>
              <NavLink href="/reminders">{t('reminders')}</NavLink>

              <div className="ms-auto flex items-center gap-2">
                <LanguageSwitcher />
                {session?.user ? (
                  <form
                    action={async () => {
                      'use server';
                      await signOut();
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                    >
                      Déconnexion
                    </button>
                  </form>
                ) : (
                  <form
                    action={async () => {
                      'use server';
                      await signIn('google');
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Connexion
                    </button>
                  </form>
                )}
              </div>
            </div>
          </nav>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: '/' | '/restaurants' | '/hotels' | '/glucose' | '/onboarding' | '/reminders';
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-zinc-600 transition hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
    >
      {children}
    </Link>
  );
}
