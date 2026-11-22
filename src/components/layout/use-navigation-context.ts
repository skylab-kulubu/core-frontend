'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCapabilities } from '@/lib/capabilities-context';
import { ticketsApi } from '@/lib/api/tickets';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import { siteEditLinks } from '@/lib/site-edit-links';
import type { UserDto } from '@/types/api';

/**
 * What the navigation needs beyond the user's groups: whether they staff any
 * door, which sites they may edit, and core's decisions for the menu links
 * that follow no group rule.
 */
export function useNavigationContext(user: UserDto): SidebarNavigationContext {
  const [doorEventIds, setDoorEventIds] = useState<string[]>([]);
  // core's editableSites, from the chrome's one capabilities read; a failed read
  // shows no site (the CMS decides edits anyway)
  const capabilities = useCapabilities();
  const editableSites =
    capabilities.status === 'ready' ? capabilities.data.editableSites : undefined;
  const editSites = useMemo(() => siteEditLinks(editableSites), [editableSites]);
  // Uygulamalar only once core says the app assignments are on and readable
  const appsVisible =
    capabilities.status === 'ready' && capabilities.data.can?.['apps.read'] === true;
  // KVKK başvuruları only once core says the register is the person's (ADMIN, YK)
  const subjectRequestsVisible =
    capabilities.status === 'ready' && capabilities.data.can?.['subjectRequest.manage'] === true;
  // Harita bölgeleri only once core says the person holds media:manage (ADMIN, YK)
  const mapRegionsVisible =
    capabilities.status === 'ready' && capabilities.data.can?.['media.delete'] === true;
  // Ekiplerim only once core names a Team the person leads (delegation on)
  const managedTeamsVisible =
    capabilities.status === 'ready' && (capabilities.data.managedTeams?.length ?? 0) > 0;

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

  return {
    hasDoorAssignment: doorEventIds.length > 0,
    appsVisible,
    managedTeamsVisible,
    subjectRequestsVisible,
    mapRegionsVisible,
    editSites,
  };
}
