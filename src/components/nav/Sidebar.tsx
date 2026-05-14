'use client';

import { useEffect, useState, type ComponentType } from 'react';
import type { Session } from 'next-auth';
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
  User,
  UtensilsCrossed,
  X,
  type LucideProps,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link, usePathname } from '@/i18n/navigation';
import { signInWithGoogle, signOutCurrentUser } from '@/lib/auth-actions';

type SidebarProps = {
  session: Session | null;
};

type NavItem = {
  label: string;
  href: '/' | '/restaurants' | '/hotels' | '/glucose' | '/onboarding' | '/reminders';
  icon: ComponentType<LucideProps>;
};

const navItems: NavItem[] = [
  { label: 'Accueil', href: '/', icon: Home },
  { label: 'Restaurants', href: '/restaurants', icon: UtensilsCrossed },
  { label: 'Hôtels', href: '/hotels', icon: Hotel },
  { label: 'Glycémie', href: '/glucose', icon: Activity },
  { label: 'Profil', href: '/onboarding', icon: User },
  { label: 'Rappels', href: '/reminders', icon: Bell },
];

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setExpanded(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const compact = !expanded;
  const authAction = session?.user ? signOutCurrentUser : signInWithGoogle;
  const AuthIcon = session?.user ? LogOut : LogIn;
  const authLabel = session?.user ? 'Déconnexion' : 'Connexion';

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((value) => !value)}
        className="fixed left-4 top-4 z-[60] inline-flex size-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-white shadow-lg lg:hidden"
        aria-label={mobileOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-950/60 lg:hidden"
          aria-label="Fermer la navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-56 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-400 shadow-2xl transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 ${
          expanded ? 'lg:w-56' : 'lg:w-[4.5rem]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Navigation principale"
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

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              compact={compact}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <div className="space-y-3 border-t border-zinc-800 p-3">
          <LanguageSwitcher
            compact={compact}
            className={`w-full border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300 ${
              compact ? 'lg:h-11 lg:w-11 lg:px-0' : ''
            }`}
          />

          <form action={authAction}>
            <button
              type="submit"
              title={compact ? authLabel : undefined}
            className={`inline-flex h-11 w-full items-center gap-3 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-500 ${
                compact ? 'lg:w-11 lg:justify-center lg:px-0' : ''
              }`}
            >
              <AuthIcon className="size-4 shrink-0" aria-hidden />
              <span className={compact ? 'lg:sr-only' : ''}>{authLabel}</span>
            </button>
          </form>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="hidden h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-800 text-sm font-medium text-zinc-300 transition-all duration-150 hover:border-emerald-500 hover:text-emerald-300 lg:inline-flex"
            aria-label={expanded ? 'Réduire la navigation' : 'Déployer la navigation'}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronLeft className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )}
            <span className={compact ? 'sr-only' : ''}>
              {expanded ? 'Réduire' : 'Déployer'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  active,
  compact,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  compact: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={compact ? item.label : undefined}
      className={`group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-all duration-150 ${
        compact ? 'lg:justify-center lg:px-0' : ''
      } ${
        active
          ? 'bg-zinc-900 text-emerald-400 shadow-[inset_3px_0_0_#10b981]'
          : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-white'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={compact ? 'lg:sr-only' : ''}>{item.label}</span>
      {compact ? (
        <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] hidden rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 lg:block">
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

function isActive(pathname: string, href: NavItem['href']): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
