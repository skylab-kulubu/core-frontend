'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  FolderTree,
  Layers,
  LogOut,
  LayoutDashboard,
  Newspaper,
  QrCode,
  Trophy,
  Users,
  UsersRound,
  Image,
  Link2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { performClientLogout } from '@/lib/auth/client-logout';
import { Avatar } from '@/components/chrome/Avatar';
import { ClubSwitcher } from '@/components/layout/ClubSwitcher';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

const NAV_ICON = {
  '/dashboard': LayoutDashboard,
  '/users': Users,
  '/groups': FolderTree,
  '/announcements': Newspaper,
  '/events': CalendarDays,
  '/seasons': Layers,
  '/sessions': Clock,
  '/teams': UsersRound,
  '/qr': QrCode,
  '/competitors': Trophy,
  '/media': Image,
  '/urls': Link2,
} as const;

type SidebarProps = Readonly<{
  navLinks: readonly SidebarNavLink[];
  prefetchedUser: UserDto;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}>;

export function Sidebar({
  navLinks,
  prefetchedUser,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const effectiveUser = user ?? prefetchedUser;
  const [userMenu, setUserMenu] = useState(false);
  const fullName = `${effectiveUser.firstName ?? ''} ${effectiveUser.lastName ?? ''}`.trim();

  useEffect(() => {
    if (!isMobileOpen) setUserMenu(false);
  }, [isMobileOpen]);

  const nav = (
    <>
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-sm font-medium tracking-wide text-neutral-200">SKY LAB</p>
        <p className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Yönetim</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Ana menü">
        <ul className="space-y-1">
          {navLinks.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = NAV_ICON[item.href as keyof typeof NAV_ICON] ?? Users;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onMobileClose?.()}
                  aria-current={active ? 'page' : undefined}
                  className={`group focus-visible:ring-skylab-400/40 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    active
                      ? 'bg-neutral-800 text-neutral-200'
                      : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate font-medium">{item.label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <ClubSwitcher />
      <div className="border-t border-white/10 px-3 py-3">
        {userMenu ? (
          <button
            type="button"
            onClick={() => void performClientLogout()}
            className="mb-2 flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-red-300 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Çıkış
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setUserMenu((v) => !v)}
          className="flex w-full items-center gap-3 rounded-md px-1 py-1 hover:bg-white/5"
        >
          <Avatar name={fullName} email={effectiveUser.email} size="md" />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm text-neutral-200">
              {fullName || effectiveUser.username}
            </p>
            <p className="text-3xs truncate text-neutral-500">{effectiveUser.email}</p>
          </div>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-neutral-950 text-neutral-200 lg:sticky lg:top-0 lg:flex">
        {nav}
      </aside>
      <div
        className={`fixed inset-0 z-40 lg:hidden ${isMobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 ${isMobileOpen ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Menüyü kapat"
          onClick={() => onMobileClose?.()}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-64 flex-col border-r border-white/10 bg-neutral-950 transition-transform ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {nav}
        </aside>
      </div>
    </>
  );
}
