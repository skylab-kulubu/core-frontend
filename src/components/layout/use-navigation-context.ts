'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useCapabilities } from '@/lib/capabilities-context';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { canManageCompetitors, canReadCertificates } from '@/lib/auth/groups';
import { showsCompetitionTab } from '@/lib/event-workspace';
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
  // core's editableSites, from the chrome's one capabilities read; a failed read
  // shows no site (the CMS decides edits anyway)
  const capabilities = useCapabilities();
  const editableSites =
    capabilities.status === 'ready' ? capabilities.data.editableSites : undefined;
  const editSites = useMemo(() => siteEditLinks(editableSites), [editableSites]);

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
    const groups = user.groups ?? [];
    eventsApi
      .get(eventId)
      .then(async (event) => {
        const canManage = canManageCompetitors(groups, event.ownerTeam);
        // Same rule as the event's tab bar; only a reader who cannot manage them needs the count
        const competitorCount = canManage
          ? 0
          : (await competitorsApi.listByEvent(event.id).catch(() => [])).length;
        return { event, canManage, competitorCount };
      })
      .then(({ event, canManage, competitorCount }) => {
        if (cancelled) return;
        const next = {
          id: event.id,
          canSeeParticipants: canListEventTickets(groups, event.ownerTeam, user.roles ?? []),
          canSeeCompetitors: showsCompetitionTab(canManage, competitorCount),
          // A cancelled Event takes no check-in (core refuses it)
          canUseDoor:
            event.status !== 'cancelled' &&
            (canDeskCheckIn(groups, event.ownerTeam, user.id, event.doorStaffIds ?? []) ||
              doorEventIds.includes(event.id)),
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
