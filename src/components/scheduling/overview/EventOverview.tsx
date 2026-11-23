'use client';

import { Card, Progress, Sparkline } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ObjectCard, ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { RosterCharts } from '@/components/scheduling/roster/RosterOverview';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { EventFeedbackPanel } from '@/components/scheduling/EventFeedbackPanel';
import { FeedbackSessionList } from '@/components/scheduling/FeedbackSessionList';
import { eventReadiness } from '@/lib/event-overview';
import { eventEditHref, eventTabHref, type EventTab } from '@/lib/event-workspace';
import { attendanceFinalizeOpen, eventDisplayStatus } from '@/lib/events-view';
import { recentRegistrations, registrationsByDay } from '@/lib/roster-insights';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  CertificateFigures,
  eventEssentialItems,
  LatestRegistrations,
  LocationBlock,
  ReadinessList,
  RelatedCounts,
  SessionAttendance,
  SessionNowNext,
  ShareLinks,
  attendanceFigures,
} from './OverviewParts';

/** What the overview reads, worked out once. */
function useOverview() {
  const ws = useEventWorkspace();
  const { event, sessions, tickets, competitors } = ws;
  const status = eventDisplayStatus(event);
  const href = (tab: EventTab) => eventTabHref(event.id, tab);
  const readiness = eventReadiness(event, sessions.length);
  const missing = readiness.filter((item) => !item.done);
  const certificate = ws.canCertificates ? ws.certificateSummary : { summary: null, failed: false };
  const seasonName = ws.editor.seasons.find((season) => season.id === event.seasonId)?.name;
  const figures = attendanceFigures(tickets);
  const days = registrationsByDay(tickets, new Date(), 14);
  const week = recentRegistrations(tickets);
  const winners = competitors.filter((row) => row.isWinner).length;
  const hasContent = ws.canMutate || Boolean(event.videos?.length || event.files?.length);
  const showsCompetition = ws.canCompetitors || competitors.length > 0;
  return {
    ws,
    event,
    status,
    href,
    readiness,
    missing,
    certificate,
    seasonName,
    figures,
    days,
    week,
    winners,
    hasContent,
    showsCompetition,
  };
}

type Overview = ReturnType<typeof useOverview>;

/** "5/8 hazır" over a bar, and the list of what is left, for a draft event. */
function PublishReadiness({ o }: { o: Overview }) {
  const done = o.readiness.length - o.missing.length;
  return (
    <ObjectCard
      title="Yayına hazırlık"
      action={
        <span className={`text-subtle-foreground tabular-nums ${TEXT_SECONDARY}`}>
          {done}/{o.readiness.length} hazır
        </span>
      }
    >
      <Progress value={done} max={o.readiness.length} aria-label="Yayına hazırlık" />
      <ReadinessList items={o.readiness} columns={4} />
    </ObjectCard>
  );
}

/**
 * What is left to do on a published event: its missing parts, and once it is over, the
 * certificates still to give.
 */
function ToDo({ o }: { o: Overview }) {
  const ended = o.status === 'ended';
  // Certificates are given once the event is over
  const summary = o.certificate.summary;
  const hasRule = Boolean(o.event.attendanceRule && o.event.attendanceRule !== 'none');
  // Attendance is closed once, after the event, and only where a certificate rule asks for it
  const finalize =
    ended &&
    hasRule &&
    o.ws.canIssueCertificate &&
    attendanceFinalizeOpen(o.event) &&
    summary !== null &&
    !summary.attendanceFinalizedAt;
  // Certificates are given once the event is over
  const toGive =
    ended && hasRule && summary ? Math.max(0, summary.eligibleCount - summary.issuedCount) : 0;
  const items = [
    ...o.missing,
    ...(finalize || toGive
      ? [
          {
            key: 'certificates-todo',
            label: finalize ? 'Katılımı kapat' : `${toGive} sertifika verilmedi`,
            done: false,
            href: o.href('certificates'),
          },
        ]
      : []),
  ];
  return (
    <ObjectCard title="Yapılacaklar">
      {items.length ? (
        <ReadinessList items={items} />
      ) : (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Eksik yok</p>
      )}
    </ObjectCard>
  );
}

/** The registration figures as linked cards: total with its trend, entries, capacity, tickets. */
function AttendanceTiles({ o }: { o: Overview }) {
  const { counts, entered, enteredShare } = o.figures;
  const participants = o.href('participants');
  const share = (part: number) => (counts.all ? (part / counts.all) * 100 : 0);
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Tile
        href={participants}
        label="Kayıt"
        value={counts.all}
        hint={o.week ? `son 7 gün +${o.week}` : 'son 7 gün yok'}
      >
        <Sparkline values={o.days.map((day) => day.count)} className="h-6 w-full" />
      </Tile>
      <Tile href={participants} label="Giriş yaptı" value={entered} hint={enteredShare}>
        <Bar share={share(entered)} className="bg-success" />
      </Tile>
      <Tile
        href={participants}
        label="Doluluk"
        value={o.event.capacity > 0 ? `${counts.all}/${o.event.capacity}` : counts.all}
        hint={
          o.event.capacity > 0
            ? `%${Math.round((counts.all / o.event.capacity) * 100)}`
            : 'sınır yok'
        }
      >
        {o.event.capacity > 0 ? (
          <Bar
            share={Math.min(100, (counts.all / o.event.capacity) * 100)}
            className={counts.all >= o.event.capacity * 0.8 ? 'bg-warning' : 'bg-skylab-400'}
          />
        ) : null}
      </Tile>
      <Tile
        href={participants}
        label="Bilet gitmedi"
        value={counts.unsent}
        hint={counts.unsent ? 'bekliyor' : 'hepsi gitti'}
        tone={counts.unsent ? 'warning' : undefined}
      />
    </div>
  );
}

function Bar({ share, className }: { share: number; className: string }) {
  return (
    <span className="bg-accent block h-1.5 overflow-hidden rounded-full">
      <span className={`block h-full rounded-full ${className}`} style={{ width: `${share}%` }} />
    </span>
  );
}

/** A figure that opens its list, drawn as the participant page's figures are. */
function Tile({
  href,
  label,
  value,
  hint,
  tone,
  children,
}: {
  href: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warning';
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="bg-card border-border-subtle hover:border-border-strong flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 transition-colors sm:p-4"
    >
      <span className={`text-subtle-foreground font-medium ${TEXT_SECONDARY}`}>{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={`text-xl leading-none font-semibold tabular-nums sm:text-2xl ${
            tone === 'warning' ? 'text-warning' : 'text-foreground-strong'
          }`}
        >
          {value}
        </span>
        {hint ? (
          <span className={`text-muted-foreground truncate ${TEXT_SECONDARY}`}>{hint}</span>
        ) : null}
      </span>
      <span className="mt-auto block min-h-6 pt-1">{children}</span>
    </Link>
  );
}

/** The overview's tail in both directions: the text, the feedback form and its sessions. */
function DescriptionAndFeedback({ o }: { o: Overview }) {
  return (
    <>
      <ObjectCard
        title="Açıklama"
        href={o.ws.canMutate ? eventEditHref(o.event.id) : undefined}
        linkLabel="Düzenle"
        linkName="Açıklamayı düzenle"
      >
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
          {o.event.description || '—'}
        </p>
      </ObjectCard>
      {o.event.feedbackFormUrl ? (
        <Card className="p-4">
          <EventFeedbackPanel event={o.event} canSend={o.ws.canMutate} />
          {o.ws.canMutate && o.event.feedbackMode === 'event_with_sessions' ? (
            <FeedbackSessionList sessions={o.ws.sessions} />
          ) : null}
        </Card>
      ) : o.ws.canMutate && o.event.feedbackMode === 'event_with_sessions' ? (
        <FeedbackSessionList sessions={o.ws.sessions} />
      ) : null}
    </>
  );
}

/**
 * The event's overview, after the admin centre's resource overview: the event's essentials as a
 * two-column property grid, then the monitoring figures and charts, then one card per
 * related part (programme, latest registrations, to-dos, links, place, certificates, files).
 */
export function EventOverview({ previous }: { previous: ReactNode }) {
  const o = useOverview();
  const { ws, event } = o;
  return (
    <div className="space-y-4">
      {previous}
      {o.status === 'draft' ? <PublishReadiness o={o} /> : null}
      <ObjectEssentials
        editHref={ws.canMutate ? eventEditHref(event.id) : undefined}
        items={eventEssentialItems({
          event,
          seasonName: o.seasonName,
          registered: ws.canTickets ? ws.tickets.length : undefined,
        })}
      />
      {ws.canTickets && o.status !== 'draft' ? (
        <section aria-label="İzleme" className="space-y-3">
          <AttendanceTiles o={o} />
          {ws.tickets.length ? <RosterCharts tickets={ws.tickets} /> : null}
        </section>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ObjectCard title="Program" href={o.href('program')}>
          <SessionNowNext
            sessions={ws.sessions}
            tickets={ws.tickets}
            ended={o.status === 'ended'}
            showEntries={ws.canTickets}
          />
          {ws.canTickets && o.status !== 'draft' ? (
            <SessionAttendance sessions={ws.sessions} tickets={ws.tickets} />
          ) : null}
        </ObjectCard>
        {ws.canTickets ? (
          <ObjectCard title="Son kayıtlar" href={o.href('participants')} linkLabel="Tümü">
            <LatestRegistrations
              tickets={ws.tickets}
              personById={ws.personById}
              participantsHref={o.href('participants')}
            />
          </ObjectCard>
        ) : null}
        {o.status !== 'draft' && ws.canMutate ? <ToDo o={o} /> : null}
        <ObjectCard title="Paylaş">
          <ShareLinks event={event} />
        </ObjectCard>
        <ObjectCard title="Konum">
          <LocationBlock event={event} />
        </ObjectCard>
        {ws.canCertificates ? (
          <ObjectCard title="Sertifikalar" href={o.href('certificates')}>
            <CertificateFigures event={event} {...o.certificate} />
          </ObjectCard>
        ) : null}
        {o.hasContent || o.showsCompetition ? (
          <ObjectCard title="İlgili">
            <RelatedCounts
              event={event}
              competitors={ws.competitors.length}
              winners={o.winners}
              contentHref={o.hasContent ? o.href('content') : undefined}
              competitionHref={o.showsCompetition ? o.href('competition') : undefined}
            />
          </ObjectCard>
        ) : null}
      </div>
      <DescriptionAndFeedback o={o} />
    </div>
  );
}
