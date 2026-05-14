'use client';

import { Globe2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({
  compact = false,
  className,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const nextLocale = locale === 'ar' ? 'fr' : 'ar';
  const label = locale === 'fr' ? 'العربية' : 'Français';

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      aria-label={`Changer la langue vers ${label}`}
      title={compact ? label : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300 ${className ?? ''}`}
    >
      {compact ? <Globe2 className="size-4" aria-hidden /> : null}
      <span className={compact ? 'sr-only' : undefined}>{label}</span>
    </button>
  );
}
