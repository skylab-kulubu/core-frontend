'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { canManageCompetitors, canReadCertificates } from '@/lib/auth/groups';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import { canDeskCheckIn, canListEventTickets } from '@/lib/tickets-ui';
import type { UserDto } from '@/types/api';

/**
 * What the navigation needs beyond the user's groups: whether they staff any
 * door, and what they may do in the event whose pages are open.
 */
export function useNavigationContext(user: UserDto): SidebarNavigationContext {
  const pathname = usePathname();
  const [doorEventIds, setDoorEventIds] = useState<string[]>([]);
  const [activeEvent, setActiveEvent] = useState<SidebarNavigationContext['activeEvent']>();

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
  }, [user.groups, user.id]);

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
        const groups = user.groups ?? [];
        const next = {
          id: event.id,
          canSeeParticipants: canListEventTickets(groups, event.ownerTeam, user.roles ?? []),
          canSeeCompetitors: canManageCompetitors(groups, event.ownerTeam),
          canUseDoor:
            canDeskCheckIn(groups, event.ownerTeam, user.id, event.doorStaffIds ?? []) ||
            doorEventIds.includes(event.id),
          canSeeCertificates: canReadCertificates(groups, user.roles ?? [], event.ownerTeam),
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
  }, [doorEventIds, pathname, user.groups, user.id, user.roles]);

  return { hasDoorAssignment: doorEventIds.length > 0, activeEvent };
}
