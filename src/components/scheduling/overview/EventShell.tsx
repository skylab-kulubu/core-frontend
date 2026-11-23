'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  SideNav,
  SideNavLayout,
  cn,
} from '@skylab-kulubu/skylcn-ui';
import { CalendarDays, DoorOpen, Mail, MapPin, MoreHorizontal, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { CoreEvent } from '@/lib/api/events';
import { eventWhenLong } from '@/lib/event-overview';
import { eventDoorHref, eventEditHref, eventTabHref, type EventTab } from '@/lib/event-workspace';
import { eventDisplayStatus, type EventDisplayStatus } from '@/lib/events-view';
import { withDesignVariant, type DesignVariant } from '@/lib/ui/design-variant';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { CoverFrame, CoverGlow, CoverNatural } from './EventCover';

/** The event's pages as both directions name them. */
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

/** Everything the two trial directions draw around a page of the event. */
export type EventShellProps = {
  variant: DesignVariant;
  event: CoreEvent;
  coverSrc?: string;
  active: EventTab;
  pages: EventShellPages;
  /** "Yayınla", when the event may be published now. */
  publish?: ReactNode;
  /** Mails the registrations, when the reader may. */
  onMail?: () => void;
  mailing?: boolean;
  /** Kopyala, Taslağa al, Başvuruyu kapat, İptal et, Sil… as menu items. */
  menuItems: ReactNode[];
  /** Registrations and entries for the header's figures; undefined when not readable. */
  figures?: { registered: number; entered: number };
  /** Cancellation, copy and error bands under the header. */
  notices: ReactNode;
  children: ReactNode;
};

function statusChips(event: CoreEvent, status: EventDisplayStatus) {
  return (
    <>
      <StatusChip kind={status} />
      {event.active && event.registrationOpen === false ? (
        <StatusChip kind="neutral" label="Başvuru kapalı" />
      ) : null}
      {event.active && event.registrationOpen ? (
        <StatusChip kind="active" label="Başvuru açık" />
      ) : null}
    </>
  );
}

function navItems(event: CoreEvent, pages: EventShellPages, variant: DesignVariant) {
  const tabs: Array<{ tab: EventTab; visible: boolean }> = [
    { tab: 'overview', visible: true },
    { tab: 'participants', visible: pages.participants },
    { tab: 'program', visible: true },
    { tab: 'competition', visible: pages.competition },
    { tab: 'certificates', visible: pages.certificates },
    { tab: 'content', visible: pages.content },
  ];
  return tabs
    .filter((row) => row.visible)
    .map(({ tab }) => ({
      tab,
      href: withDesignVariant(eventTabHref(event.id, tab), variant),
      label: EVENT_TAB_LABELS[tab],
      count: pages.counts[tab],
    }));
}

function MoreMenu({ items, label }: { items: ReactNode[]; label?: string }) {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(BUTTON_TEXT, 'shrink-0')}
            aria-label={label ? undefined : 'Diğer eylemler'}
          >
            <MoreHorizontal aria-hidden />
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align="end">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A command of the A direction's bar: an icon and its name, as a link or a button. */
function Command({
  icon: Icon,
  label,
  href,
  onClick,
  disabled,
}: {
  icon: typeof Pencil;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(BUTTON_TEXT, 'shrink-0')}
      disabled={disabled}
      onClick={onClick}
      render={href ? <Link href={href} /> : undefined}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

/**
 * Direction A, the admin centre's resource page (Microsoft Entra / Azure portal): the event's
 * name with the open page beside it, a bar of written commands under it, and the event's own
 * menu on the left, its pages grouped by what they are for.
 */
export function EventShellA(props: EventShellProps) {
  const { event, coverSrc, active, pages, publish, onMail, mailing, menuItems, notices } = props;
  const status = eventDisplayStatus(event);
  const items = navItems(event, pages, 'a');
  const pick = (tabs: EventTab[]) =>
    items
      .filter((row) => tabs.includes(row.tab))
      .map((row) => ({
        href: row.href,
        label: row.label,
        badge: row.count === undefined ? undefined : row.count,
      }));
  const sections = [
    { items: pick(['overview']) },
    { label: 'Katılım', items: pick(['participants', 'program', 'competition']) },
    { label: 'Sonrası', items: pick(['certificates', 'content']) },
    pages.edit
      ? {
          label: 'Ayarlar',
          items: [{ href: withDesignVariant(eventEditHref(event.id), 'a'), label: 'Düzenle' }],
        }
      : null,
  ].filter((section): section is NonNullable<typeof section> => Boolean(section?.items.length));
  const activeHref = items.find((row) => row.tab === active)?.href;
  const place = [event.location, eventWhenLong(event)].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4" data-design="a">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <CoverFrame src={coverSrc} name={event.name} className="w-full shrink-0 sm:w-44" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
              Etkinlik · {event.ownerTeam || 'Genel'}
            </p>
            <h1 className="text-foreground-strong text-xl leading-tight font-semibold">
              {event.name}
              {active !== 'overview' ? (
                <span className="text-subtle-foreground font-normal">
                  {' '}
                  | {EVENT_TAB_LABELS[active]}
                </span>
              ) : null}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">{statusChips(event, status)}</div>
            {place ? <p className={`text-muted-foreground ${TEXT_SECONDARY}`}>{place}</p> : null}
          </div>
        </div>
        <div
          role="toolbar"
          aria-label="Etkinlik komutları"
          className="border-border-subtle scrollbar-hidden -mx-1 flex items-center gap-1 overflow-x-auto border-y px-1 py-1.5"
        >
          {publish}
          {pages.edit ? (
            <Command
              icon={Pencil}
              label="Düzenle"
              href={withDesignVariant(eventEditHref(event.id), 'a')}
            />
          ) : null}
          {pages.door ? (
            <Command icon={DoorOpen} label="Kapı" href={eventDoorHref(event.id)} />
          ) : null}
          {onMail ? (
            <Command icon={Mail} label="E-posta gönder" onClick={onMail} disabled={mailing} />
          ) : null}
          <MoreMenu items={menuItems} label="Diğer" />
        </div>
      </header>
      {notices}
      <SideNavLayout
        nav={<SideNav aria-label="Etkinlik" sections={sections} activeHref={activeHref} />}
      >
        {props.children}
      </SideNavLayout>
    </div>
  );
}

/**
 * Direction B, the organizer's event page (Luma, Eventbrite): the whole cover in its own shape
 * on its own colours, the name large beside it with date, place and figures, the main actions,
 * and the pages as a row of pills, no tab line.
 */
export function EventShellB(props: EventShellProps) {
  const { event, coverSrc, active, pages, publish, onMail, mailing, menuItems, notices, figures } =
    props;
  const status = eventDisplayStatus(event);
  const items = navItems(event, pages, 'b');
  const when = eventWhenLong(event);
  return (
    <div className="space-y-4" data-design="b">
      <header className="border-border-subtle bg-card relative overflow-hidden rounded-xl border">
        <CoverGlow src={coverSrc} />
        <div className="relative grid gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-center">
          <div className="flex justify-center md:justify-start">
            <CoverNatural
              src={coverSrc}
              name={event.name}
              className={
                coverSrc ? 'max-h-[26rem] w-auto max-w-full md:max-h-72' : 'w-40 md:w-full'
              }
            />
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">{statusChips(event, status)}</div>
            <h1 className="text-foreground-strong text-2xl leading-tight font-semibold sm:text-3xl">
              {event.name}
            </h1>
            <ul className="text-muted-foreground space-y-1 text-sm">
              {when ? (
                <li className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {when}
                </li>
              ) : null}
              {event.location ? (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {event.location}
                    {event.locationAddress ? (
                      <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                        {event.locationAddress}
                      </span>
                    ) : null}
                  </span>
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
                {event.ownerTeam || 'Genel'}
              </li>
            </ul>
            {figures ? (
              <dl className="flex flex-wrap gap-x-6 gap-y-2">
                <HeroFigure label="Kayıt" value={figures.registered} of={event.capacity} />
                <HeroFigure label="Giriş" value={figures.entered} />
              </dl>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {publish}
              {pages.door ? (
                <Button
                  variant={status === 'live' ? 'primary' : 'outline'}
                  className={BUTTON_TEXT}
                  render={<Link href={eventDoorHref(event.id)} />}
                >
                  <DoorOpen aria-hidden />
                  Kapıyı aç
                </Button>
              ) : null}
              {pages.edit ? (
                <Button
                  variant="outline"
                  className={BUTTON_TEXT}
                  render={<Link href={withDesignVariant(eventEditHref(event.id), 'b')} />}
                >
                  <Pencil aria-hidden />
                  Düzenle
                </Button>
              ) : null}
              {onMail ? (
                <Button
                  variant="outline"
                  className={BUTTON_TEXT}
                  disabled={mailing}
                  onClick={onMail}
                >
                  <Mail aria-hidden />
                  E-posta
                </Button>
              ) : null}
              <MoreMenu items={menuItems} />
            </div>
          </div>
        </div>
      </header>
      <nav
        aria-label="Etkinlik"
        className="bg-background/85 scrollbar-hidden sticky top-(--skylcn-sticky-top) z-10 -mx-1 overflow-x-auto px-1 py-1 backdrop-blur"
      >
        <ul className="flex w-max gap-1.5">
          {items.map((item) => {
            const on = item.tab === active;
            return (
              <li key={item.tab}>
                <Link
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                    on
                      ? 'border-foreground-strong bg-foreground-strong text-background'
                      : 'border-border-subtle text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {item.label}
                  {item.count !== undefined ? (
                    <span
                      className={cn('tabular-nums', on ? 'opacity-70' : 'text-subtle-foreground')}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {notices}
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

function HeroFigure({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <div>
      <dt className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{label}</dt>
      <dd className="text-foreground-strong text-2xl leading-tight font-semibold tabular-nums">
        {value}
        {of && of > 0 ? (
          <span className="text-subtle-foreground text-base font-normal"> / {of}</span>
        ) : null}
      </dd>
    </div>
  );
}
