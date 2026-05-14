import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DiaboPeekPortal } from '@/components/diabo/DiaboPeekPortal';
import { Sidebar } from '@/components/nav/Sidebar';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
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

  const [messages, session] = await Promise.all([getMessages(), auth()]);

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full font-sans">
        <NextIntlClientProvider messages={messages}>
          <Sidebar session={session} />
          <DiaboPeekPortal />
          <main className="ml-[4.5rem] flex min-h-full flex-1 flex-col lg:ml-56">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
