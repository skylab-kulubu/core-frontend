'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import {
  CalendarDays,
  Award,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Image,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Trophy,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/chrome/Avatar';
import { ClubSwitcher } from '@/components/layout/ClubSwitcher';
import { useAuth } from '@/context/AuthContext';
import { performClientLogout } from '@/lib/auth/client-logout';
import { clubRoleLabel, displayPersonName } from '@/lib/chrome-role';
import {
  buildSidebarNavigation,
  type SidebarNavigationContext,
  type SidebarNavLink,
  type SidebarNavNode,
} from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';
import { isTopModalLayer, registerModalLayer } from '@/lib/ui/modal-layer';

const NAV_ICON = {
  '/dashboard': LayoutDashboard,
  '/users': Users,
  '/groups': FolderTree,
  '/announcements': Newspaper,
  '/events': CalendarDays,
  '/events?view=calendar': CalendarDays,
  '/events/new': CalendarDays,
  '/seasons': Layers,
  '/teams': UsersRound,
  '/qr': QrCode,
  '/competitors': Trophy,
  '/media': Image,
  '/urls': Link2,
  '/certificates/templates': Award,
  '/certificates/defaults': Award,
  '/certificates/issued': Award,
  '/certificates/jobs': Award,
} as const;

const GROUP_ICON = {
  events: CalendarDays,
  'active-event': CalendarDays,
  club: UsersRound,
  content: Newspaper,
  certificates: Award,
} as const;

type SidebarProps = Readonly<{
  prefetchedUser: UserDto;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  navigationContext?: SidebarNavigationContext;
  isDesktopCollapsed?: boolean;
  onDesktopCollapsedChange?: (collapsed: boolean) => void;
}>;

function isActive(pathname: string, currentSearch: string, href: string): boolean {
  const [hrefWithoutHash, hash = ''] = href.split('#');
  if (hash) return false;
  const [path, wantedSearch = ''] = hrefWithoutHash.split('?');
  if (path === '/events' && pathname !== '/events') return false;
  if (pathname !== path) {
    return path !== '/dashboard' && pathname.startsWith(`${path}/`);
  }
  if (wantedSearch) {
    const current = new URLSearchParams(currentSearch);
    const wanted = new URLSearchParams(wantedSearch);
    return [...wanted].every(([key, value]) => current.get(key) === value);
  }
  if (path === '/events') return !new URLSearchParams(currentSearch).has('view');
  return pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`));
}

function NavItem({
  item,
  pathname,
  currentSearch,
  onClick,
  collapsed = false,
}: {
  item: SidebarNavLink;
  pathname: string;
  currentSearch: string;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const Icon = NAV_ICON[item.href as keyof typeof NAV_ICON] ?? ChevronRight;
  const active = isActive(pathname, currentSearch, item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`focus-visible:ring-skylab-400/40 group flex min-h-9 items-center rounded-md py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        collapsed ? 'justify-center px-1' : 'gap-2 px-2'
      } ${
        active
          ? 'bg-skylab-500/10 text-skylab-300'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {collapsed ? null : <span className="truncate font-medium">{item.label}</span>}
    </Link>
  );
}

function NavGroup({
  node,
  pathname,
  currentSearch,
  onItemClick,
  collapsed = false,
  onExpand,
}: {
  node: Extract<SidebarNavNode, { kind: 'group' }>;
  pathname: string;
  currentSearch: string;
  onItemClick?: () => void;
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const active =
    node.id === 'active-event' ||
    node.children.some((item) => isActive(pathname, currentSearch, item.href));
  const [open, setOpen] = useState(node.id === 'events' || node.id === 'active-event' || active);
  const controlsId = `${useId()}-${node.id}`;
  const Icon = GROUP_ICON[node.id as keyof typeof GROUP_ICON] ?? FolderTree;
  const storageKey = `skylab.admin.nav-group.${node.id}`;

  useEffect(() => {
    if (active) {
      setOpen(true);
      window.localStorage.setItem(storageKey, 'true');
      return;
    }
    const saved = window.localStorage.getItem(storageKey);
    if (saved !== null) setOpen(saved === 'true');
  }, [active, storageKey]);

  function toggle() {
    if (collapsed) {
      onExpand?.();
      setOpen(true);
      window.localStorage.setItem(storageKey, 'true');
      return;
    }
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={collapsed ? false : open}
        aria-controls={controlsId}
        onClick={toggle}
        title={collapsed ? node.label : undefined}
        className={`focus-visible:ring-skylab-400/40 flex min-h-10 w-full items-center rounded-md py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
          collapsed ? 'justify-center px-1' : 'gap-3 px-3'
        } ${
          active
            ? 'text-neutral-100'
            : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        {collapsed ? null : (
          <>
            <span className="truncate font-medium">{node.label}</span>
            <ChevronDown
              className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>
      {open && !collapsed ? (
        <div id={controlsId} className="ml-5 space-y-1 border-l border-neutral-800 pl-3">
          {node.children.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              currentSearch={currentSearch}
              onClick={onItemClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  prefetchedUser,
  onItemClick,
  navigationContext,
  collapsed = false,
  onCollapsedChange,
}: {
  prefetchedUser: UserDto;
  onItemClick?: () => void;
  navigationContext?: SidebarNavigationContext;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const currentSearch = useSearchParams().toString();
  const { user } = useAuth();
  const effectiveUser = user ?? prefetchedUser;
  const nodes = buildSidebarNavigation(effectiveUser, navigationContext);
  const fullName = displayPersonName(
    effectiveUser.firstName,
    effectiveUser.lastName,
    effectiveUser.username,
  );
  const subtitle = effectiveUser.email?.trim() || effectiveUser.username || '--';
  const roleLabel = clubRoleLabel(effectiveUser.groups ?? []);

  return (
    <div className={`flex h-full w-full flex-col py-5 ${collapsed ? 'gap-3 px-2' : 'gap-4 px-4'}`}>
      <nav aria-label="Ana navigasyon" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {nodes.map((node) =>
          node.kind === 'link' ? (
            <NavItem
              key={node.href}
              item={node}
              pathname={pathname}
              currentSearch={currentSearch}
              onClick={onItemClick}
              collapsed={collapsed}
            />
          ) : (
            <NavGroup
              key={node.id}
              node={node}
              pathname={pathname}
              currentSearch={currentSearch}
              onItemClick={onItemClick}
              collapsed={collapsed}
              onExpand={() => onCollapsedChange?.(false)}
            />
          ),
        )}
      </nav>

      <div className="mt-auto space-y-2 border-t border-white/5 pt-3">
        <div
          className={`flex items-center ${collapsed ? 'flex-col justify-center gap-1' : 'gap-3 px-2'}`}
          title={collapsed ? `${fullName} · ${roleLabel}` : undefined}
        >
          <Avatar name={fullName} email={effectiveUser.email} size={collapsed ? 'md' : 'lg'} />
          {collapsed ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-100">{fullName}</p>
              <p className="truncate text-xs text-neutral-500">{subtitle}</p>
              <p className="text-3xs mt-0.5 truncate text-neutral-400">{roleLabel}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void performClientLogout()}
            aria-label="Çıkış yap"
            title={collapsed ? 'Çıkış yap' : undefined}
            className={`hover:text-skylab-500 rounded-lg bg-transparent p-2 text-neutral-500 transition-colors ${
              collapsed ? '' : 'ml-auto'
            }`}
          >
            <LogOut size={16} />
          </button>
        </div>
        <ClubSwitcher collapsed={collapsed} />
        {onCollapsedChange ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className={`focus-visible:ring-skylab-400/40 flex min-h-9 w-full items-center rounded-md py-2 text-sm text-neutral-500 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none ${
              collapsed ? 'justify-center px-1' : 'gap-3 px-2'
            }`}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {collapsed ? null : <span>Menüyü daralt</span>}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar({
  prefetchedUser,
  isMobileOpen = false,
  onMobileClose,
  navigationContext,
  isDesktopCollapsed = false,
  onDesktopCollapsedChange,
}: SidebarProps) {
  const mobileDialogRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onMobileCloseRef = useRef(onMobileClose);
  const mobileLayerId = useId();
  onMobileCloseRef.current = onMobileClose;

  useEffect(() => {
    if (!isMobileOpen) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unregisterLayer = registerModalLayer(mobileLayerId);
    mobileCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isTopModalLayer(mobileLayerId)) return;
        event.preventDefault();
        onMobileCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        mobileDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unregisterLayer();
      returnFocusRef.current?.focus();
    };
  }, [isMobileOpen, mobileLayerId]);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 hidden bg-neutral-950 text-neutral-200 transition-[width] duration-200 md:flex ${
          isDesktopCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent
          prefetchedUser={prefetchedUser}
          navigationContext={navigationContext}
          collapsed={isDesktopCollapsed}
          onCollapsedChange={onDesktopCollapsedChange}
        />
      </aside>
      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Menü dışını kapat"
            onClick={() => onMobileClose?.()}
          />
          <aside
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Ana menü"
            className="absolute inset-y-0 left-0 flex h-full w-72 flex-col border-r border-neutral-800 bg-[#070707] shadow-xl"
          >
            <button
              ref={mobileCloseRef}
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => onMobileClose?.()}
              className="focus-visible:ring-skylab-400/40 mt-3 mr-4 -mb-3 self-end rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              prefetchedUser={prefetchedUser}
              navigationContext={navigationContext}
              onItemClick={() => onMobileClose?.()}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
