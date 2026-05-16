'use client';

import { useEffect, useState, useSyncExternalStore, type ComponentType } from 'react';
import type { Session } from 'next-auth';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  Home,
  Hotel,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  UtensilsCrossed,
  X,
  type LucideProps,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CommandPalette } from '@/components/nav/CommandPalette';
import { Link, usePathname } from '@/i18n/navigation';
import { signOutCurrentUser } from '@/lib/auth-actions';

type SidebarProps = {
  session: Session | null;
};

type NavLabelKey =
  | 'home'
  | 'restaurants'
  | 'hotels'
  | 'glucose'
  | 'profile'
  | 'reminders'
  | 'settings';

type NavHref =
  | '/'
  | '/restaurants'
  | '/hotels'
  | '/glucose'
  | '/onboarding'
  | '/reminders'
  | '/settings';

type NavItem = {
  labelKey: NavLabelKey;
  href: NavHref;
  icon: ComponentType<LucideProps>;
};

const navItems: NavItem[] = [
  { labelKey: 'home', href: '/', icon: Home },
  { labelKey: 'restaurants', href: '/restaurants', icon: UtensilsCrossed },
  { labelKey: 'hotels', href: '/hotels', icon: Hotel },
  { labelKey: 'glucose', href: '/glucose', icon: Activity },
  { labelKey: 'reminders', href: '/reminders', icon: Bell },
];

const bottomNavItems: NavItem[] = [
  { labelKey: 'profile', href: '/onboarding', icon: User },
  { labelKey: 'settings', href: '/settings', icon: Settings },
];

const SIDEBAR_WIDTH = {
  compact: '4.5rem',
  expanded: '14rem',
} as const;
const SIDEBAR_STORAGE_KEY = 'diabo_sidebar_expanded';
const sidebarExpandedListeners = new Set<() => void>();

function setRootSidebarWidth(expanded: boolean) {
  document.documentElement.style.setProperty(
    '--sidebar-w',
    expanded ? SIDEBAR_WIDTH.expanded : SIDEBAR_WIDTH.compact,
  );
}

function getStoredSidebarExpanded() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

function getServerSidebarExpanded() {
  return false;
}

function subscribeSidebarExpanded(listener: () => void) {
  sidebarExpandedListeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    sidebarExpandedListeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function setStoredSidebarExpanded(expanded: boolean) {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded));
  setRootSidebarWidth(expanded);
  sidebarExpandedListeners.forEach((listener) => listener());
}

export function Sidebar({ session }: SidebarProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('sidebar');
  const expanded = useSyncExternalStore(
    subscribeSidebarExpanded,
    getStoredSidebarExpanded,
    getServerSidebarExpanded,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setRootSidebarWidth(expanded);
  }, [expanded]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const compact = !expanded;
  const isRtl = locale === 'ar';
  const userLabel = session?.user?.name ?? session?.user?.email ?? t('defaultAccount');
  const mobileSideClass = isRtl ? 'right-3' : 'left-3';
  const badgeSideClass = isRtl ? '-left-1' : '-right-1';
  const asideSideClass = isRtl
    ? `right-0 border-l ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`
    : `left-0 border-r ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((value) => !value)}
        className={`fixed top-3 z-[60] inline-flex size-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-white shadow-lg shadow-zinc-950/20 transition-all duration-150 hover:border-emerald-500 lg:hidden ${mobileSideClass}`}
        aria-label={mobileOpen ? t('closeNavigation') : t('openNavigation')}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <X className="size-5" aria-hidden />
        ) : (
          <>
            <span
              className={`absolute -top-1 grid size-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-zinc-950 ${badgeSideClass}`}
            >
              D
            </span>
            <Menu className="size-5" aria-hidden />
          </>
        )}
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-950/60 lg:hidden"
          aria-label={t('closeNavigation')}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 z-50 flex h-dvh w-56 flex-col border-zinc-800/60 bg-zinc-900/95 text-zinc-400 shadow-2xl backdrop-blur-sm transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 ${
          expanded ? 'lg:w-56' : 'lg:w-[4.5rem]'
        } ${asideSideClass}`}
        aria-label={t('navigation')}
      >
        <div
          className={`flex h-16 items-center border-b border-zinc-800 px-4 ${
            compact ? 'lg:justify-center' : 'justify-start'
          }`}
        >
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            title="Diabo"
            className="inline-flex min-w-0 items-center gap-3 text-white"
            aria-label="Diabo"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">
              D
            </span>
            <span
              className={`text-sm font-semibold transition-opacity ${
                compact ? 'lg:sr-only' : ''
              }`}
            >
              Diabo
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 pb-5 pt-16 lg:pt-5">
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              active={isActive(pathname, item.href)}
              compact={compact}
              isRtl={isRtl}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div className="space-y-3 border-t border-zinc-800 p-3">
          <div className="space-y-1">
            {bottomNavItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                label={t(item.labelKey)}
                active={isActive(pathname, item.href)}
                compact={compact}
                isRtl={isRtl}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-emerald-500 hover:text-emerald-300 lg:inline-flex"
            title={compact ? t('search') : undefined}
          >
            <Search className="size-4" aria-hidden />
            <span className={compact ? 'sr-only' : ''}>{t('search')}</span>
          </button>

          <LanguageSwitcher
            compact={compact}
            className={`w-full border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300 ${
              compact ? 'lg:h-11 lg:w-11 lg:px-0' : ''
            }`}
          />

          <ThemeToggle
            compact={compact}
            labelToDark={t('themeToDark')}
            labelToLight={t('themeToLight')}
          />

          {session?.user ? (
            <div className="space-y-2">
              <p
                className={`px-1 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400 ${
                  compact ? 'lg:sr-only' : ''
                }`}
              >
                {t('account')}
              </p>
              <p
                className={`truncate px-1 text-xs font-medium text-zinc-300 ${
                  compact ? 'lg:sr-only' : ''
                }`}
                title={userLabel}
              >
                {userLabel}
              </p>
              <form action={signOutCurrentUser}>
                <button
                  type="submit"
                  title={compact ? t('signOut') : undefined}
                  className={`inline-flex h-11 w-full items-center gap-3 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-500 ${
                    compact ? 'lg:w-11 lg:justify-center lg:px-0' : ''
                  }`}
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  <span className={compact ? 'lg:sr-only' : ''}>
                    {t('signOut')}
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                title={compact ? t('signIn') : undefined}
                className={`inline-flex h-11 w-full items-center gap-3 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-500 ${
                  compact ? 'lg:w-11 lg:justify-center lg:px-0' : ''
                }`}
              >
                <LogIn className="size-4 shrink-0" aria-hidden />
                <span className={compact ? 'lg:sr-only' : ''}>{t('signIn')}</span>
              </Link>
              <Link
                href="/signup"
                title={compact ? t('signUp') : undefined}
                className={`inline-flex h-11 w-full items-center gap-3 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-emerald-500 hover:text-emerald-300 ${
                  compact ? 'lg:w-11 lg:justify-center lg:px-0' : ''
                }`}
              >
                <User className="size-4 shrink-0" aria-hidden />
                <span className={compact ? 'lg:sr-only' : ''}>{t('signUp')}</span>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStoredSidebarExpanded(!expanded)}
            className="hidden h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-emerald-500 hover:text-emerald-300 lg:inline-flex"
            aria-label={expanded ? t('collapse') : t('expand')}
            aria-expanded={expanded}
          >
            {expanded ? (
              isRtl ? (
                <ChevronRight className="size-4" aria-hidden />
              ) : (
                <ChevronLeft className="size-4" aria-hidden />
              )
            ) : isRtl ? (
              <ChevronLeft className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )}
            <span className={compact ? 'sr-only' : ''}>
              {expanded ? t('collapse') : t('expand')}
            </span>
          </button>
        </div>
      </aside>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

function SidebarLink({
  active,
  compact,
  isRtl,
  item,
  label,
  onNavigate,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  compact: boolean;
  isRtl: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const activeShadow = isRtl
    ? 'bg-zinc-900 text-emerald-400 shadow-[inset_-3px_0_0_#10b981]'
    : 'bg-zinc-900 text-emerald-400 shadow-[inset_3px_0_0_#10b981]';
  const tooltipSide = isRtl
    ? 'right-[calc(100%+0.75rem)]'
    : 'left-[calc(100%+0.75rem)]';

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={compact ? label : undefined}
      className={`group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-all duration-150 ${
        compact ? 'lg:justify-center lg:px-0' : ''
      } ${
        active ? activeShadow : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-white'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={compact ? 'lg:sr-only' : ''}>{label}</span>
      {compact ? (
        <span
          className={`pointer-events-none absolute hidden rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 lg:block ${tooltipSide}`}
        >
          {label}
        </span>
      ) : null}
    </Link>
  );
}

function ThemeToggle({
  compact,
  labelToDark,
  labelToLight,
}: {
  compact: boolean;
  labelToDark: string;
  labelToLight: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? labelToLight : labelToDark;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      aria-pressed={isDark}
      title={compact ? label : undefined}
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-emerald-500 hover:text-emerald-300 ${
        compact ? 'lg:w-11 lg:px-0' : ''
      }`}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
      <span className={compact ? 'lg:sr-only' : ''}>{label}</span>
    </button>
  );
}

function isActive(pathname: string, href: NavHref): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
