'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { canManageCompetitors, canReadCertificates } from '@/lib/auth/groups';
import type { SidebarNavigationContext, SidebarNavLink } from '@/lib/navigation/sidebar-nav';
import { siteEditLinks } from '@/lib/site-edit-links';
import { canDeskCheckIn, canListEventTickets } from '@/lib/tickets-ui';
import type { UserDto } from '@/types/api';

/**
 * What the navigation needs beyond the user's groups: whether they staff any
 * door, which sites they may edit, and what they may do in the event whose
 * pages are open.
 */
export function useNavigationContext(user: UserDto): SidebarNavigationContext {
  const pathname = usePathname();
  const [doorEventIds, setDoorEventIds] = useState<string[]>([]);
  const [activeEvent, setActiveEvent] = useState<SidebarNavigationContext['activeEvent']>();
  const [editSites, setEditSites] = useState<SidebarNavLink[]>([]);

  // core's editableSites; a failed read shows no site (the CMS decides edits anyway)
  useEffect(() => {
    let cancelled = false;
    capabilitiesApi
      .get()
      .then((capabilities) => {
        if (!cancelled) setEditSites(siteEditLinks(capabilities?.editableSites));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user.id]);

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

  // The event's tabs are routes under it; moving between them keeps the event read once
  const eventMatch = pathname.match(/^\/events\/([^/]+)(?:\/|$)/);
  const openEventId =
    eventMatch?.[1] && eventMatch[1] !== 'new' ? decodeURIComponent(eventMatch[1]) : null;

  useEffect(() => {
    if (!openEventId) {
      setActiveEvent(undefined);
      return;
    }
    const eventId = openEventId;
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
  }, [doorEventIds, openEventId, user.groups, user.id, user.roles]);

  return { hasDoorAssignment: doorEventIds.length > 0, editSites, activeEvent };
}
