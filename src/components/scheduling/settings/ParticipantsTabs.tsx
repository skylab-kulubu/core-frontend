'use client';

import { TabsNav } from '@skylab-kulubu/skylcn-ui';
import { usePathname } from 'next/navigation';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { eventRegistrationSettingsHref, eventTabHref } from '@/lib/event-workspace';

/**
 * Katılımcılar's two parts: the list, and beside it the settings of registering (form,
 * capacity, ticket) for who edits the event. Others see the list alone.
 */
export function ParticipantsTabs() {
  const { event, canMutate } = useEventWorkspace();
  const pathname = usePathname() ?? '';
  if (!canMutate) return null;
  const list = eventTabHref(event.id, 'participants');
  const settings = eventRegistrationSettingsHref(event.id);
  return (
    <TabsNav
      aria-label="Katılımcılar"
      className="mb-4"
      items={[
        { href: list, label: 'Liste' },
        { href: settings, label: 'Kayıt ayarları' },
      ]}
      activeHref={pathname.replace(/\/$/, '').endsWith('/settings') ? settings : list}
    />
  );
}
