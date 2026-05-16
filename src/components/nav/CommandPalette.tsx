'use client';

import {
  Activity,
  Bell,
  Home,
  Hotel,
  Search,
  User,
  UtensilsCrossed,
  type LucideProps,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
};

type CommandLabelKey =
  | 'home'
  | 'restaurants'
  | 'hotels'
  | 'glucose'
  | 'profile'
  | 'reminders';

type CommandHref =
  | '/'
  | '/restaurants'
  | '/hotels'
  | '/glucose'
  | '/onboarding'
  | '/reminders';

type CommandItem = {
  labelKey: CommandLabelKey;
  href: CommandHref;
  icon: ComponentType<LucideProps>;
};

const COMMAND_ITEMS: CommandItem[] = [
  { labelKey: 'home', href: '/', icon: Home },
  { labelKey: 'restaurants', href: '/restaurants', icon: UtensilsCrossed },
  { labelKey: 'hotels', href: '/hotels', icon: Hotel },
  { labelKey: 'glucose', href: '/glucose', icon: Activity },
  { labelKey: 'profile', href: '/onboarding', icon: User },
  { labelKey: 'reminders', href: '/reminders', icon: Bell },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const tNav = useTranslations('sidebar');
  const tCommand = useTranslations('command');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commandItems = useMemo(
    () =>
      COMMAND_ITEMS.map((item) => ({
        ...item,
        label: tNav(item.labelKey),
      })),
    [tNav],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commandItems;
    return commandItems.filter((item) =>
      item.label.toLowerCase().includes(normalized),
    );
  }, [commandItems, query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) =>
          filteredItems.length === 0
            ? 0
            : (current + 1) % filteredItems.length,
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) =>
          filteredItems.length === 0
            ? 0
            : (current - 1 + filteredItems.length) % filteredItems.length,
        );
        return;
      }

      if (event.key === 'Enter') {
        const item = filteredItems[selectedIndex];
        if (!item) return;
        event.preventDefault();
        router.push(item.href);
        onOpenChange(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, onOpenChange, open, router, selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-zinc-950/60 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="mx-4 mt-32 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:mx-auto">
        <div className="relative">
          <Search
            className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-zinc-400 ${
              isRtl ? 'right-4' : 'left-4'
            }`}
            aria-hidden
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder={tCommand('searchPlaceholder')}
            className={`diabo-field rounded-none border-0 border-b border-zinc-200 dark:border-zinc-800 ${
              isRtl ? 'pr-10' : 'pl-10'
            }`}
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              {tCommand('empty')}
            </p>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const selected = index === selectedIndex;
              return (
                <button
                  key={item.href}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    router.push(item.href);
                    onOpenChange(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isRtl ? 'text-right' : 'text-left'
                  } ${
                    selected
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
