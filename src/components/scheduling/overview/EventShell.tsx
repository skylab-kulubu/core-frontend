'use client';

import { DoorOpen, Mail, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Command, CommandBar, CommandMenu } from '@/components/chrome/object-page/CommandBar';
import { ObjectPage, ObjectPageHeader } from '@/components/chrome/object-page/ObjectPage';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { CoreEvent } from '@/lib/api/events';
import { eventInitials, eventWhenLong } from '@/lib/event-overview';
import { eventDoorHref, eventEditHref, eventTabHref, type EventTab } from '@/lib/event-workspace';
import { eventDisplayStatus } from '@/lib/events-view';

/** The event's pages as its menu names them. */
export const EVENT_TAB_LABELS: Record<EventTab, string> = {
  overview: 'Genel bakış',
  participants: 'Katılımcılar',
  program: 'Program',
  certificates: 'Sertifikalar',
  content: 'Dosyalar',
  competition: 'Yarışma',
};

/** What the reader may open, and the counts written beside each page. */
export type EventShellPages = {
  participants: boolean;
  certificates: boolean;
  content: boolean;
  competition: boolean;
  door: boolean;
  edit: boolean;
  counts: Partial<Record<EventTab, number>>;
};

export type EventShellProps = {
  event: CoreEvent;
  coverSrc?: string;
  /** The open page; null on the edit page, which has no menu. */
  active: EventTab | null;
  pages: EventShellPages;
  /** How many applied, when the reader may see it; written among the badges. */
  registrations?: number;
  /** "Yayınla", when the event may be published now. */
  publish?: ReactNode;
  /** Mails the registrations, when the reader may. */
  onMail?: () => void;
  mailing?: boolean;
  /** Kopyala, Taslağa al, Başvuruyu kapat, İptal et, Sil… as menu items. */
  menuItems: ReactNode[];
  /** Cancellation, copy and error bands under the header. */
  notices: ReactNode;
  children: ReactNode;
};

/**
 * An event as an object page (the admin centre's resource page): its cover band, a bar of
 * written commands, and the event's own menu on the left, its pages grouped by what they are for.
 * While the event runs, the door is the command to use and is drawn as the main one.
 */
export function EventShell({
  event,
  coverSrc,
  active,
  pages,
  registrations,
  publish,
  onMail,
  mailing,
  menuItems,
  notices,
  children,
}: EventShellProps) {
  const status = eventDisplayStatus(event);
  const onEditPage = active === null;
  const item = (tab: EventTab) => ({
    href: eventTabHref(event.id, tab),
    label: EVENT_TAB_LABELS[tab],
    badge: pages.counts[tab],
  });
  const sections = [
    { items: [item('overview')] },
    {
      label: 'Katılım',
      items: [
        ...(pages.participants ? [item('participants')] : []),
        item('program'),
        ...(pages.competition ? [item('competition')] : []),
      ],
    },
    {
      label: 'Sonrası',
      items: [
        ...(pages.certificates ? [item('certificates')] : []),
        ...(pages.content ? [item('content')] : []),
      ],
    },
  ].filter((section): section is NonNullable<typeof section> => Boolean(section?.items.length));
  const facts = [event.location, eventWhenLong(event)].filter(Boolean).join(' · ');

  return (
    <ObjectPage
      header={
        <ObjectPageHeader
          eyebrow={`Etkinlik · ${event.ownerTeam || 'Genel'}`}
          title={event.name}
          section={
            onEditPage ? 'Düzenle' : active !== 'overview' ? EVENT_TAB_LABELS[active] : undefined
          }
          cover={{ src: coverSrc, initials: eventInitials(event.name) }}
          badges={
            <>
              <StatusChip kind={status} />
              {event.active && event.registrationOpen === false ? (
                <StatusChip kind="neutral" label="Başvuru kapalı" />
              ) : null}
              {event.active && event.registrationOpen ? (
                <StatusChip kind="active" label="Başvuru açık" />
              ) : null}
              {registrations !== undefined ? (
                <StatusChip kind="neutral" label={`${registrations} başvuru`} />
              ) : null}
            </>
          }
          meta={facts || undefined}
        />
      }
      commands={
        <CommandBar label="Etkinlik komutları">
          {pages.door && status === 'live' ? (
            <Command icon={DoorOpen} label="Kapı" href={eventDoorHref(event.id)} primary />
          ) : null}
          {publish}
          {pages.edit && !onEditPage ? (
            <Command icon={Pencil} label="Düzenle" href={eventEditHref(event.id)} />
          ) : null}
          {pages.door && status !== 'live' ? (
            <Command icon={DoorOpen} label="Kapı" href={eventDoorHref(event.id)} />
          ) : null}
          {onMail ? (
            <Command icon={Mail} label="E-posta gönder" onClick={onMail} disabled={mailing} />
          ) : null}
          <CommandMenu items={menuItems} />
        </CommandBar>
      }
      notices={notices}
      menu={
        onEditPage
          ? undefined
          : {
              label: 'Etkinlik',
              sections,
              activeHref: eventTabHref(event.id, active),
            }
      }
    >
      {children}
    </ObjectPage>
  );
}
