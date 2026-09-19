'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { MobileSidebarContext } from './MobileSidebarContext';
import { CommandPalette } from './CommandPalette';
import type { UserDto } from '@/types/api';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { canManageCompetitors, canReadCertificates } from '@/lib/auth/groups';
import { canDeskCheckIn, canListEventTickets } from '@/lib/tickets-ui';
import { useBodyScrollLock } from '@/lib/ui/use-body-scroll-lock';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';

type AuthenticatedChromeProps = Readonly<{
  children: React.ReactNode;
  sidebarUser: UserDto;
}>;

export function AuthenticatedChrome({ children, sidebarUser }: AuthenticatedChromeProps) {
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [doorEventIds, setDoorEventIds] = useState<string[]>([]);
  const [activeEvent, setActiveEvent] = useState<SidebarNavigationContext['activeEvent']>();
  useBodyScrollLock(isMobileSidebarOpen);

  useEffect(() => {
    let cancelled = false;
    ticketsApi
      .listDoorEvents()
      .then((events) => {
        if (!cancelled) setDoorEventIds(events.map((event) => event.id));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sidebarUser.groups, sidebarUser.id]);

  useEffect(() => {
    const match = pathname.match(/^\/events\/([^/]+)(?:\/|$)/);
    if (!match?.[1] || match[1] === 'new') {
      setActiveEvent(undefined);
      return;
    }
    const eventId = decodeURIComponent(match[1]);
    let cancelled = false;
    eventsApi
      .get(eventId)
      .then((event) => {
        if (cancelled) return;
        const groups = sidebarUser.groups ?? [];
        const next = {
          id: event.id,
          canSeeParticipants: canListEventTickets(groups, event.ownerTeam, sidebarUser.roles ?? []),
          canSeeCompetitors: canManageCompetitors(groups, event.ownerTeam),
          canUseDoor:
            canDeskCheckIn(groups, event.ownerTeam, sidebarUser.id, event.doorStaffIds ?? []) ||
            doorEventIds.includes(event.id),
          canSeeCertificates: canReadCertificates(groups, sidebarUser.roles ?? [], event.ownerTeam),
        };
        setActiveEvent(
          next.canSeeParticipants ||
            next.canSeeCompetitors ||
            next.canUseDoor ||
            next.canSeeCertificates
            ? next
            : undefined,
        );
      })
      .catch(() => {
        if (!cancelled) setActiveEvent(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [doorEventIds, pathname, sidebarUser.groups, sidebarUser.id]);

  const navigationContext: SidebarNavigationContext = {
    hasDoorAssignment: doorEventIds.length > 0,
    activeEvent,
  };

  useEffect(() => {
    setIsDesktopSidebarCollapsed(
      window.localStorage.getItem('skylab.admin.sidebar-collapsed') === 'true',
    );
  }, []);

  function setDesktopSidebarCollapsed(collapsed: boolean) {
    setIsDesktopSidebarCollapsed(collapsed);
    window.localStorage.setItem('skylab.admin.sidebar-collapsed', String(collapsed));
  }

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    if (desktop.matches) setIsMobileSidebarOpen(false);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileSidebarOpen(false);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  return (
    <MobileSidebarContext.Provider
      value={{
        open: () => setIsMobileSidebarOpen(true),
        close: () => setIsMobileSidebarOpen(false),
        isOpen: isMobileSidebarOpen,
      }}
    >
      <div
        className={`min-h-dvh transition-[padding] duration-200 md:h-dvh md:bg-neutral-950 md:py-2 md:pr-2 ${
          isDesktopSidebarCollapsed ? 'md:pl-18' : 'md:pl-66'
        }`}
      >
        <Sidebar
          prefetchedUser={sidebarUser}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
          navigationContext={navigationContext}
          isDesktopCollapsed={isDesktopSidebarCollapsed}
          onDesktopCollapsedChange={setDesktopSidebarCollapsed}
        />

        <div
          inert={isMobileSidebarOpen || undefined}
          className="sticky top-0 z-40 border-b border-neutral-950/70 bg-neutral-950/40 backdrop-blur md:hidden"
        >
          <div className="flex h-14 items-center px-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="focus-visible:ring-skylab-400/40 inline-flex items-center justify-center rounded-md p-2 text-neutral-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-2 min-w-0 flex-1">
              <Breadcrumbs />
            </div>
            <CommandPalette
              user={sidebarUser}
              enableShortcut={false}
              navigationContext={navigationContext}
            />
          </div>
        </div>

        <div
          inert={isMobileSidebarOpen || undefined}
          className="md:flex md:h-full md:min-h-0 md:flex-col md:overflow-hidden md:rounded-xl md:border md:border-white/5 md:bg-neutral-900"
        >
          <div className="hidden h-10 shrink-0 items-center gap-4 border-b border-white/5 px-6 md:flex">
            <Breadcrumbs />
            <CommandPalette user={sidebarUser} navigationContext={navigationContext} />
          </div>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</div>
          </div>
        </div>
      </div>
    </MobileSidebarContext.Provider>
  );
}
