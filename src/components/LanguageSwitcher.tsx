'use client';

import { Globe2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({
  compact = false,
  className,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations('language');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextLocale = locale === 'ar' ? 'fr' : 'ar';
  const label = locale === 'fr' ? t('arabic') : t('french');

  return (
    <button
      type="button"
      onClick={() => {
        window.localStorage.setItem('diabo_locale', nextLocale);
        const query = searchParams.toString();
        window.location.assign(
          `/${nextLocale}${pathname}${query ? `?${query}` : ''}`,
        );
      }}
      aria-label={t('switchTo', { locale: label })}
      title={compact ? label : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-all duration-150 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300 ${className ?? ''}`}
    >
      {compact ? <Globe2 className="size-4" aria-hidden /> : null}
      <span className={compact ? 'sr-only' : undefined}>{label}</span>
    </button>
  );
}
