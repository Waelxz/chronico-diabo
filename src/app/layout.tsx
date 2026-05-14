import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

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
      "Compagnon IA empathique pour le diabète au quotidien. Conçu pour le Maghreb francophone.",
    locale: 'fr_FR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Diabo
            </Link>
            <Link
              href="/restaurants"
              className="text-sm text-zinc-600 transition hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
            >
              Restaurants
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
