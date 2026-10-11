'use client';

import { buttonVariants, cn, Tab, Tabs, TabsList } from '@skylab-kulubu/skylcn-ui';
import { DoorOpen } from 'lucide-react';
import Link from 'next/link';
import { eventTabHref, type EventTab } from '@/lib/event-workspace';

type EventWorkspaceNavProps = {
  eventId: string;
  /** The tab whose route is open. */
  active: EventTab;
  canSeeParticipants?: boolean;
  canSeeCompetitors?: boolean;
  canUseDoor?: boolean;
  canSeeCertificates?: boolean;
  /** Whether the Event has files or videos to show, or the reader may add some. */
  canSeeFiles?: boolean;
};

/**
 * The event's tabs, each a route under /events/[id]. skylcn-ui's Tabs switch
 * panels, so every tab renders as a link and the open route picks the tab.
 */
export function EventWorkspaceNav({
  eventId,
  active,
  canSeeParticipants = false,
  canSeeCompetitors = false,
  canUseDoor = false,
  canSeeCertificates = false,
  canSeeFiles = false,
}: EventWorkspaceNavProps) {
  const tabs: Array<{ tab: EventTab; label: string; visible: boolean }> = [
    { tab: 'overview', label: 'Genel bakış', visible: true },
    { tab: 'participants', label: 'Katılımcılar', visible: canSeeParticipants },
    { tab: 'program', label: 'Program', visible: true },
    { tab: 'certificates', label: 'Sertifikalar', visible: canSeeCertificates },
    { tab: 'content', label: 'İçerik', visible: canSeeFiles },
    { tab: 'competition', label: 'Yarışma', visible: canSeeCompetitors },
  ];
  return (
    <nav
      aria-label="Etkinlik çalışma alanı"
      className="border-border flex items-center gap-2 border-b"
    >
      <Tabs value={active} className="min-w-0 flex-1">
        <TabsList className="border-b-0">
          {tabs
            .filter((item) => item.visible)
            .map((item) => (
              <Tab
                key={item.tab}
                value={item.tab}
                nativeButton={false}
                render={<Link href={eventTabHref(eventId, item.tab)} />}
              >
                {item.label}
              </Tab>
            ))}
        </TabsList>
      </Tabs>
      {canUseDoor ? (
        <Link
          href={`/qr?eventId=${encodeURIComponent(eventId)}`}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'text-skylab-300 shrink-0',
          )}
        >
          <DoorOpen aria-hidden /> Kapı
        </Link>
      ) : null}
    </nav>
  );
}
