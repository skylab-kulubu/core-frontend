'use client';

import {
  BarList,
  CopyButton,
  type DescriptionItem,
  IconButton,
  cn,
} from '@skylab-kulubu/skylcn-ui';
import { CheckCircle2, Circle, Clock, FileText, MapPin, QrCode, Trophy, Video } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { QrPreview } from '@/components/chrome/QrPreview';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { CertificateEventSummary } from '@/lib/api/certificates';
import type { CoreEvent } from '@/lib/api/events';
import type { Person } from '@/lib/api/identity';
import type { EventSession } from '@/lib/api/sessions';
import type { Ticket } from '@/lib/api/tickets';
import { shortQrFileName, shortQrPath, shortQrUrl } from '@/lib/api/urls';
import {
  capacityFill,
  certificateRuleLabel,
  checkInsBySession,
  checkedInCount,
  eventShareLinks,
  eventWhenLong,
  latestRegistrations,
  sessionClock,
  sessionNowAndNext,
  type ReadinessItem,
} from '@/lib/event-overview';
import { MAP_ATTRIBUTION, MAP_ATTRIBUTION_URL } from '@/lib/event-location';
import { publicMediaUrl } from '@/lib/event-media';
import { eventDisplayStatus, EVENT_STATUS_LABELS } from '@/lib/events-view';
import { organizersLine } from '@/lib/event-organizers';
import { rosterViewCounts } from '@/lib/roster-insights';
import { formatApplicantWhen, ticketApplicantName, ticketTypeLabel } from '@/lib/tickets-ui';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const percent = (part: number, whole: number) =>
  whole ? `%${Math.round((part / whole) * 100)}` : '—';

/** The things an event needs, ticked when done; each open one goes where it is filled. */
export function ReadinessList({
  items,
  columns = 1,
}: {
  items: readonly ReadinessItem[];
  columns?: 1 | 2 | 4;
}) {
  return (
    <ul
      className={cn(
        'grid gap-1',
        columns === 2 && 'sm:grid-cols-2',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {items.map((item) => (
        <li key={item.key}>
          <Link
            href={item.href}
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            {item.done ? (
              <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            ) : (
              <Circle className="text-warning size-4 shrink-0" aria-hidden />
            )}
            <span className={item.done ? 'text-muted-foreground' : 'text-foreground'}>
              {item.label}
            </span>
            <span className="sr-only">{item.done ? 'tamam' : 'eksik'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The event's key facts for the object page's essentials: when, where, who, how people apply. */
export function eventEssentialItems({
  event,
  seasonName,
  registered,
  doorStaffHref,
}: {
  event: CoreEvent;
  seasonName?: string;
  registered?: number;
  /** Where the door staff are chosen, for who may change them: the count links there. */
  doorStaffHref?: string;
}): DescriptionItem[] {
  const doorStaff = event.doorStaffIds?.length ? `${event.doorStaffIds.length} kişi` : 'Yok';
  const status = eventDisplayStatus(event);
  const fill = registered === undefined ? null : capacityFill(registered, event.capacity);
  const registration =
    event.status === 'draft'
      ? 'Yayında değil'
      : event.registrationOpen
        ? event.registrationClosesAt
          ? `Açık, ${eventWhenLong({ startDate: event.registrationClosesAt })} kapanır`
          : 'Açık'
        : 'Kapalı';
  const items = [
    { label: 'Durum', value: <StatusChip kind={status} label={EVENT_STATUS_LABELS[status]} /> },
    { label: 'Tarih', value: eventWhenLong(event) || '—' },
    {
      label: 'Yer',
      value: event.location ? (
        <span>
          {event.location}
          {event.locationAddress ? (
            <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
              {event.locationAddress}
            </span>
          ) : null}
        </span>
      ) : (
        '—'
      ),
    },
    { label: 'Ekip', value: organizersLine(event) },
    { label: 'Sezon', value: seasonName || '—' },
    {
      label: 'Kontenjan',
      value:
        event.capacity > 0
          ? fill
            ? `${event.capacity} kişi · ${fill.left} yer kaldı`
            : `${event.capacity} kişi`
          : 'Sınırsız',
    },
    { label: 'Kayıt', value: registration },
    { label: 'Sertifika kuralı', value: certificateRuleLabel(event) },
    {
      label: 'Kapı görevlisi',
      value: doorStaffHref ? (
        <Link
          href={doorStaffHref}
          className="text-skylab-300 hover:text-foreground underline decoration-dotted underline-offset-4"
        >
          {doorStaff}
        </Link>
      ) : (
        doorStaff
      ),
    },
    ...(event.ranked
      ? [
          {
            label: 'Yarışma',
            value: event.prizeInfo ? `Sıralamalı · ${event.prizeInfo}` : 'Sıralamalı',
          },
        ]
      : []),
  ];
  return items;
}

/** The session running now and the next one, with how many came to each. */
export function SessionNowNext({
  sessions,
  tickets,
  ended,
  showEntries,
}: {
  sessions: readonly EventSession[];
  tickets: readonly Ticket[];
  ended: boolean;
  /** Writes how many entered the running session; only for a reader who sees the registrations. */
  showEntries: boolean;
}) {
  const { current, next } = sessionNowAndNext(sessions);
  const entered = checkInsBySession(tickets);
  if (!sessions.length) {
    return <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Program yok</p>;
  }
  const rows = [
    current ? { tag: 'Şimdi', session: current, live: true } : null,
    next ? { tag: 'Sıradaki', session: next, live: false } : null,
  ].filter((row): row is { tag: string; session: EventSession; live: boolean } => Boolean(row));
  if (!rows.length) {
    return (
      <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
        {ended ? `${sessions.length} oturum yapıldı` : 'Saati belli oturum yok'}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map(({ tag, session, live }) => (
        <li
          key={tag}
          className={cn(
            'rounded-md border px-3 py-2',
            live ? 'border-success/40 bg-success/5' : 'border-border-subtle',
          )}
        >
          <p className={`flex items-center gap-1.5 ${TEXT_SECONDARY}`}>
            <span className={live ? 'text-success font-medium' : 'text-subtle-foreground'}>
              {tag}
            </span>
            <span className="text-subtle-foreground inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {sessionClock(session)}
            </span>
          </p>
          <p className="text-foreground text-sm font-medium">{session.title}</p>
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
            {[
              session.speakerName,
              live && showEntries ? `${entered.get(session.id) ?? 0} giriş` : '',
            ]
              .filter(Boolean)
              .join(' · ') || ' '}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** How many of the registrations entered each session, as bars against the whole list. */
export function SessionAttendance({
  sessions,
  tickets,
  limit = 6,
}: {
  sessions: readonly EventSession[];
  tickets: readonly Ticket[];
  limit?: number;
}) {
  const entered = checkInsBySession(tickets);
  const rows = sessions.filter((session) => !session.cancelled).slice(0, limit);
  if (!rows.length || !tickets.length) return null;
  return (
    <div className="space-y-1.5">
      <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Oturumlara giriş</p>
      <BarList
        max={tickets.length}
        items={rows.map((session) => ({
          key: session.id,
          label: session.title,
          value: entered.get(session.id) ?? 0,
          detail: `${entered.get(session.id) ?? 0} · ${percent(entered.get(session.id) ?? 0, tickets.length)}`,
        }))}
      />
    </div>
  );
}

/** The latest registrations, newest first, each opening its registration. */
export function LatestRegistrations({
  tickets,
  personById,
  participantsHref,
  count = 5,
}: {
  tickets: readonly Ticket[];
  personById: Map<string, Person>;
  participantsHref: string;
  count?: number;
}) {
  const rows = latestRegistrations(tickets, count);
  if (!rows.length) {
    return <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Kayıt yok</p>;
  }
  const join = participantsHref.includes('?') ? '&' : '?';
  return (
    <ul className="divide-border-subtle -mx-1 divide-y">
      {rows.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`${participantsHref}${join}kayit=${encodeURIComponent(ticket.id)}`}
            className="hover:bg-accent flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
          >
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm">
                {ticketApplicantName(ticket, personById)}
              </span>
              <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                {ticketTypeLabel(ticket.ticketType)}
              </span>
            </span>
            <span className={`text-subtle-foreground shrink-0 tabular-nums ${TEXT_SECONDARY}`}>
              {formatApplicantWhen(ticket.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The event's links to hand out, each copied in one press, with its QR beside it. */
export function ShareLinks({ event }: { event: CoreEvent }) {
  const links = eventShareLinks(event);
  const [qrAlias, setQrAlias] = useState<string | null>(null);
  if (!links.length) {
    return <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Paylaşılacak bağlantı yok</p>;
  }
  return (
    <>
      <ul className="space-y-2">
        {links.map((link) => (
          <li
            key={link.key}
            className="border-border-subtle flex items-center gap-2 rounded-md border py-1 pr-1 pl-3"
          >
            <span className="min-w-0 flex-1">
              <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>{link.label}</span>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-skylab-300 hover:text-foreground block truncate text-sm"
              >
                {link.url.replace(/^https?:\/\//, '')}
              </a>
            </span>
            <CopyButton value={link.url} label={`${link.label} bağlantısını kopyala`} />
            {link.alias ? (
              <IconButton
                icon={QrCode}
                variant="ghost"
                label={`${link.label} QR`}
                onClick={() => setQrAlias(link.alias ?? null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <Drawer open={qrAlias !== null} onClose={() => setQrAlias(null)} title="QR">
        {qrAlias ? (
          <QrPreview
            imageUrl={shortQrUrl(qrAlias)}
            downloadPath={shortQrPath(qrAlias, { size: 1024 })}
            fileName={shortQrFileName(qrAlias)}
            label={`QR ${qrAlias}`}
          />
        ) : null}
      </Drawer>
    </>
  );
}

/** Where the event is: core's map of the point with its credit, else the place in words. */
export function LocationBlock({ event }: { event: CoreEvent }) {
  if (!event.location && !event.mapImageUrl) {
    return <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Yer yok</p>;
  }
  return (
    <figure className="space-y-1.5">
      {event.mapImageUrl ? (
        <img
          src={publicMediaUrl(event.mapImageUrl)}
          alt={`${event.location} haritası`}
          className="border-border w-full rounded-md border"
          width={1280}
          height={480}
        />
      ) : null}
      <figcaption className={`flex flex-wrap items-start justify-between gap-2 ${TEXT_SECONDARY}`}>
        <span className="text-foreground inline-flex items-start gap-1.5">
          <MapPin className="text-subtle-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {event.location}
            {event.locationAddress ? (
              <span className="text-subtle-foreground block">{event.locationAddress}</span>
            ) : null}
          </span>
        </span>
        {event.mapImageUrl ? (
          <a
            href={event.mapAttributionUrl || MAP_ATTRIBUTION_URL}
            target="_blank"
            rel="noreferrer"
            className="text-subtle-foreground hover:text-foreground"
          >
            {event.mapAttribution || MAP_ATTRIBUTION}
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** Certificates in figures: the rule, who qualifies, how many were given. */
export function CertificateFigures({
  event,
  summary,
  failed,
}: {
  event: CoreEvent;
  summary: CertificateEventSummary | null;
  failed: boolean;
}) {
  const rule = certificateRuleLabel(event);
  return (
    <div className="space-y-2">
      <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Kural: {rule}</p>
      {failed ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Sayılar yüklenemedi</p>
      ) : summary ? (
        <div className="grid grid-cols-3 gap-2">
          <Figure label="Hak eden" value={summary.eligibleCount} />
          <Figure label="Verilen" value={summary.issuedCount} />
          <Figure label="İptal" value={summary.revokedCount} />
        </div>
      ) : null}
    </div>
  );
}

/** A small labelled count inside a card. */
export function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warning' | 'success';
}) {
  return (
    <div className="min-w-0">
      <p className={`text-subtle-foreground truncate ${TEXT_SECONDARY}`}>{label}</p>
      <p
        className={cn(
          'text-lg leading-tight font-semibold tabular-nums',
          tone === 'warning'
            ? 'text-warning'
            : tone === 'success'
              ? 'text-success'
              : 'text-foreground-strong',
        )}
      >
        {value}
        {hint ? (
          <span className={`text-muted-foreground ml-1.5 font-normal ${TEXT_SECONDARY}`}>
            {hint}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** Files, videos and competitors: what else the event holds, each a way into its page. */
export function RelatedCounts({
  event,
  competitors,
  winners,
  contentHref,
  competitionHref,
}: {
  event: CoreEvent;
  competitors: number;
  winners: number;
  contentHref?: string;
  competitionHref?: string;
}) {
  const files = event.files?.length ?? event.fileCount ?? 0;
  const videos = event.videos?.length ?? event.videoCount ?? 0;
  const rows = [
    contentHref
      ? { key: 'files', icon: FileText, label: 'Dosya', value: files, href: contentHref }
      : null,
    contentHref
      ? { key: 'videos', icon: Video, label: 'Video', value: videos, href: contentHref }
      : null,
    competitionHref
      ? {
          key: 'competitors',
          icon: Trophy,
          label: winners ? `Yarışmacı · ${winners} kazanan` : 'Yarışmacı',
          value: competitors,
          href: competitionHref,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!rows.length) return null;
  return (
    <ul className="space-y-1">
      {rows.map(({ key, icon: Icon, label, value, href }) => (
        <li key={key}>
          <Link
            href={href}
            className="hover:bg-accent flex items-center gap-2 rounded-md px-1 py-1.5 text-sm"
          >
            <Icon className="text-subtle-foreground size-4" aria-hidden />
            <span className="text-foreground flex-1">{label}</span>
            <span className="text-foreground-strong font-medium tabular-nums">{value}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Registrations, entries and what is waiting, as the participant page counts them. */
export function attendanceFigures(tickets: readonly Ticket[]) {
  const counts = rosterViewCounts(tickets);
  const entered = checkedInCount(tickets);
  return { counts, entered, enteredShare: percent(entered, counts.all) };
}
