'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  FolderTree,
  Image,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  Newspaper,
  QrCode,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { performClientLogout } from '@/lib/auth/client-logout';
import { Avatar } from '@/components/chrome/Avatar';
import { ClubSwitcher } from '@/components/layout/ClubSwitcher';
import { clubRoleLabel, displayPersonName } from '@/lib/chrome-role';
import { groupSidebarNav } from '@/lib/chrome-nav';
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

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-2 text-xs font-medium tracking-wide text-neutral-400 select-none">
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = NAV_ICON[href as keyof typeof NAV_ICON] ?? Users;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group focus-visible:ring-skylab-400/40 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        active
          ? 'bg-neutral-800 text-neutral-200'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span className="truncate font-medium">{label}</span>
      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SidebarContent({
  navLinks,
  prefetchedUser,
  onItemClick,
}: {
  navLinks: readonly SidebarNavLink[];
  prefetchedUser: UserDto;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const effectiveUser = user ?? prefetchedUser;
  const fullName = displayPersonName(
    effectiveUser.firstName,
    effectiveUser.lastName,
    effectiveUser.username,
  );
  const subtitle = effectiveUser.email?.trim() || effectiveUser.username || '--';
  const sections = groupSidebarNav(navLinks);

  return (
    <div className="flex h-full w-full flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3 px-2">
        <Avatar name={fullName} email={effectiveUser.email} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-100">{fullName}</p>
          <p className="truncate text-xs text-neutral-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void performClientLogout()}
          aria-label="Çıkış yap"
          className="hover:text-skylab-500 ml-auto rounded-lg bg-transparent py-1 text-xs font-semibold text-neutral-500 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="text-2xs w-full rounded-md border border-white/10 bg-white/3 px-2 py-1 text-center text-neutral-200">
        {clubRoleLabel(effectiveUser.groups ?? [])}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label ?? section.items[0]?.href} className="space-y-2">
            {section.label ? <SectionLabel>{section.label}</SectionLabel> : null}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={pathname === item.href || Boolean(pathname?.startsWith(`${item.href}/`))}
                  onClick={onItemClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2">
        <ClubSwitcher />
      </div>
    </div>
  );
}

export function Sidebar({
  navLinks,
  prefetchedUser,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-neutral-950 text-neutral-200 md:flex">
        <SidebarContent navLinks={navLinks} prefetchedUser={prefetchedUser} />
      </aside>
      <div
        className={`fixed inset-0 z-50 md:hidden ${isMobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/40 ${isMobileOpen ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Menüyü kapat"
          onClick={() => onMobileClose?.()}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex h-full w-72 flex-col border-r border-neutral-800 bg-[#070707] shadow-xl transition-transform ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent
            navLinks={navLinks}
            prefetchedUser={prefetchedUser}
            onItemClick={() => onMobileClose?.()}
          />
        </aside>
      </div>
    </>
  );
}
