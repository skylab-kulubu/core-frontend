'use client';

import { DoorOpen, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { Command, CommandBar, CommandMenu } from '@/components/chrome/object-page/CommandBar';
import { ObjectPage, ObjectPageHeader } from '@/components/chrome/object-page/ObjectPage';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { CoreEvent } from '@/lib/api/events';
import { eventInitials, eventWhenLong } from '@/lib/event-overview';
import {
  EVENT_SETTINGS_PAGES,
  eventDoorHref,
  eventSettingsHref,
  eventTabHref,
  type EventPage,
  type EventTab,
} from '@/lib/event-workspace';
import { eventDisplayStatus } from '@/lib/events-view';

/** The event's pages as its menu names them. */
export const EVENT_TAB_LABELS: Record<EventTab, string> = {
  overview: 'Genel bakış',
  participants: 'Katılımcılar',
  program: 'Program',
  checkin: 'Kapı',
  competition: 'Yarışma',
  emails: 'Postalar',
  certificates: 'Sertifikalar',
  content: 'Dosyalar',
};

/** The menu's group of the event's own settings (not the panel's Ayarlar). */
export const EVENT_SETTINGS_LABEL = 'Etkinlik ayarları';

/** What the reader may open, and the counts written beside each page. */
export type EventShellPages = {
  participants: boolean;
  certificates: boolean;
  content: boolean;
  competition: boolean;
  /** The scanning page (/door), the bar's Kapı command. */
  door: boolean;
  /** Kapı in the menu: the door's layout, staff and QR. */
  checkin: boolean;
  /** Postalar and the Etkinlik ayarları group: who edits the event. */
  settings: boolean;
  counts: Partial<Record<EventTab, number>>;
};

export type EventShellProps = {
  event: CoreEvent;
  coverSrc?: string;
  /** The open page. */
  page: EventPage;
  pages: EventShellPages;
  /** How many applied, when the reader may see it; written among the badges. */
  registrations?: number;
  /** "Yayınla", when the event may be published now. */
  publish?: ReactNode;
  /** Mails the registrations, when the reader may. */
  onMail?: () => void;
  mailing?: boolean;
  /** Kopyala, Taslağa al, Kayıtları kapat, İptal et, Sil… as menu items. */
  menuItems: ReactNode[];
  /** Cancellation, copy and error bands under the header. */
  notices: ReactNode;
  children: ReactNode;
};

/** The open page's name after the event's, and the menu item marked current. */
function openPage(eventId: string, page: EventPage): { section?: string; href: string } {
  if (page.kind === 'settings') {
    const setting = EVENT_SETTINGS_PAGES.find((row) => row.key === page.page);
    return { section: setting?.label, href: eventSettingsHref(eventId, page.page) };
  }
  return {
    section: page.tab === 'overview' ? undefined : EVENT_TAB_LABELS[page.tab],
    // Kayıt ayarları is a part of Katılımcılar: the menu marks Katılımcılar
    href: eventTabHref(eventId, page.tab),
  };
}

/**
 * An event as an object page (the admin centre's resource page): its cover band, a bar of
 * written commands, and the event's own menu on the left, its pages grouped by what they are for.
 * Each tab keeps its own settings; the event's name, time, team and look sit in the last group.
 * While the event runs, the door is the command to use and is drawn as the main one.
 */
export function EventShell({
  event,
  coverSrc,
  page,
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
        ...(pages.checkin ? [item('checkin')] : []),
        ...(pages.competition ? [item('competition')] : []),
        ...(pages.settings ? [item('emails')] : []),
      ],
    },
    {
      label: 'Sonrası',
      items: [
        ...(pages.certificates ? [item('certificates')] : []),
        ...(pages.content ? [item('content')] : []),
      ],
    },
    {
      label: EVENT_SETTINGS_LABEL,
      items: pages.settings
        ? EVENT_SETTINGS_PAGES.map((row) => ({
            href: eventSettingsHref(event.id, row.key),
            label: row.label,
          }))
        : [],
    },
  ].filter((section) => section.items.length > 0);
  const open = openPage(event.id, page);
  const facts = [event.location, eventWhenLong(event)].filter(Boolean).join(' · ');

  return (
    <ObjectPage
      header={
        <ObjectPageHeader
          eyebrow={`Etkinlik · ${event.ownerTeam || 'Genel'}`}
          title={event.name}
          section={open.section}
          cover={{ src: coverSrc, initials: eventInitials(event.name) }}
          badges={
            <>
              <StatusChip kind={status} />
              {event.active && event.registrationOpen === false ? (
                <StatusChip kind="neutral" label="Kayıt kapalı" />
              ) : null}
              {event.active && event.registrationOpen ? (
                <StatusChip kind="active" label="Kayıt açık" />
              ) : null}
              {registrations !== undefined ? (
                <StatusChip kind="neutral" label={`${registrations} kayıt`} />
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
      menu={{
        label: 'Etkinlik',
        sections,
        activeHref: open.href,
      }}
    >
      {children}
    </ObjectPage>
  );
}
