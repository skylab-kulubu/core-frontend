'use client';

import { Card, Progress, Sparkline } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RosterCharts } from '@/components/scheduling/roster/RosterOverview';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { EventFeedbackPanel } from '@/components/scheduling/EventFeedbackPanel';
import { FeedbackSessionList } from '@/components/scheduling/FeedbackSessionList';
import { eventReadiness, sessionNowAndNext, sessionClock } from '@/lib/event-overview';
import { eventEditHref, eventTabHref, type EventTab } from '@/lib/event-workspace';
import { attendanceFinalizeOpen, eventDisplayStatus } from '@/lib/events-view';
import { recentRegistrations, registrationsByDay } from '@/lib/roster-insights';
import { withDesignVariant, type DesignVariant } from '@/lib/ui/design-variant';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  CapacityMeter,
  CertificateFigures,
  EventEssentials,
  Figure,
  GuestMemberSplit,
  LatestRegistrations,
  LocationBlock,
  OverviewCard,
  ReadinessList,
  RelatedCounts,
  SessionAttendance,
  SessionNowNext,
  ShareLinks,
  attendanceFigures,
  useCertificateSummary,
} from './OverviewParts';

/** What both directions read for the overview, worked out once. */
function useOverview(variant: DesignVariant) {
  const ws = useEventWorkspace();
  const { event, sessions, tickets, competitors } = ws;
  const status = eventDisplayStatus(event);
  const href = (tab: EventTab) => withDesignVariant(eventTabHref(event.id, tab), variant);
  const readiness = eventReadiness(event, sessions.length);
  const missing = readiness.filter((item) => !item.done);
  const certificate = useCertificateSummary(event.id, ws.canCertificates && status !== 'draft');
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
function PublishReadiness({ o, columns }: { o: Overview; columns: 2 | 4 }) {
  const done = o.readiness.length - o.missing.length;
  return (
    <OverviewCard
      title="Yayına hazırlık"
      action={
        <span className={`text-subtle-foreground tabular-nums ${TEXT_SECONDARY}`}>
          {done}/{o.readiness.length} hazır
        </span>
      }
    >
      <Progress value={done} max={o.readiness.length} aria-label="Yayına hazırlık" />
      <ReadinessList items={o.readiness} columns={columns} />
    </OverviewCard>
  );
}

/**
 * What is left to do on a published event: its missing parts, and once it is over, the
 * certificates still to give.
 */
function ToDo({ o }: { o: Overview }) {
  const ended = o.status === 'ended';
  // Certificates are given once the event is over
  const toGive =
    ended && o.certificate.summary && o.event.attendanceRule && o.event.attendanceRule !== 'none'
      ? Math.max(0, o.certificate.summary.eligibleCount - o.certificate.summary.issuedCount)
      : 0;
  const finalize = ended && o.ws.canIssueCertificate && attendanceFinalizeOpen(o.event);
  const items = [
    ...o.missing,
    ...(finalize || toGive
      ? [
          {
            key: 'certificate' as const,
            label: toGive ? `${toGive} sertifika verilmedi` : 'Katılımı kapat',
            done: false,
            href: o.href('certificates'),
          },
        ]
      : []),
  ];
  return (
    <OverviewCard title="Yapılacaklar">
      {items.length ? (
        <ReadinessList items={items} />
      ) : (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Eksik yok</p>
      )}
    </OverviewCard>
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
      <OverviewCard title="Açıklama" href={eventEditHref(o.event.id)} linkLabel="Düzenle">
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
          {o.event.description || '—'}
        </p>
      </OverviewCard>
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
 * Direction A, after the admin centre's resource overview: the event's essentials as a
 * two-column property grid, then the monitoring figures and charts, then one card per
 * related part (programme, latest registrations, to-dos, links, place, certificates, files).
 */
export function EventOverviewA({ previous }: { previous: ReactNode }) {
  const o = useOverview('a');
  const { ws, event } = o;
  return (
    <div className="space-y-4">
      {previous}
      {o.status === 'draft' ? <PublishReadiness o={o} columns={4} /> : null}
      <OverviewCard title="Temel bilgiler" href={eventEditHref(event.id)} linkLabel="Düzenle">
        <EventEssentials
          event={event}
          seasonName={o.seasonName}
          registered={ws.canTickets ? ws.tickets.length : undefined}
        />
      </OverviewCard>
      {ws.canTickets && o.status !== 'draft' ? (
        <section aria-label="İzleme" className="space-y-3">
          <AttendanceTiles o={o} />
          <RosterCharts tickets={ws.tickets} />
        </section>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard title="Program" href={o.href('program')}>
          <SessionNowNext
            sessions={ws.sessions}
            tickets={ws.tickets}
            ended={o.status === 'ended'}
          />
        </OverviewCard>
        {ws.canTickets ? (
          <OverviewCard title="Son kayıtlar" href={o.href('participants')} linkLabel="Tümü">
            <LatestRegistrations
              tickets={ws.tickets}
              personById={ws.personById}
              participantsHref={o.href('participants')}
            />
          </OverviewCard>
        ) : null}
        {o.status !== 'draft' && ws.canMutate ? <ToDo o={o} /> : null}
        <OverviewCard title="Paylaş">
          <ShareLinks event={event} />
        </OverviewCard>
        <OverviewCard title="Konum">
          <LocationBlock event={event} />
        </OverviewCard>
        {ws.canCertificates ? (
          <OverviewCard title="Sertifikalar" href={o.href('certificates')}>
            <CertificateFigures event={event} {...o.certificate} />
          </OverviewCard>
        ) : null}
        {o.hasContent || o.showsCompetition ? (
          <OverviewCard title="İlgili">
            <RelatedCounts
              event={event}
              competitors={ws.competitors.length}
              winners={o.winners}
              contentHref={o.hasContent ? o.href('content') : undefined}
              competitionHref={o.showsCompetition ? o.href('competition') : undefined}
            />
          </OverviewCard>
        ) : null}
      </div>
      <DescriptionAndFeedback o={o} />
    </div>
  );
}

/**
 * Direction B, after the organizer pages of Luma and Eventbrite: large cards, one per part
 * of the event, each with its figure and a way into its page; a draft opens on its
 * publishing checklist.
 */
export function EventOverviewB({ previous }: { previous: ReactNode }) {
  const o = useOverview('b');
  const { ws, event } = o;
  const { counts, entered, enteredShare } = o.figures;
  const { current, next } = sessionNowAndNext(ws.sessions);
  const draft = o.status === 'draft';
  return (
    <div className="space-y-4">
      {previous}
      {draft ? <PublishReadiness o={o} columns={2} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {ws.canTickets && !draft ? (
          <OverviewCard
            title="Katılımcılar"
            href={o.href('participants')}
            linkLabel="Listeyi aç"
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure
                label="Kayıt"
                value={counts.all}
                hint={o.week ? `+${o.week} bu hafta` : undefined}
              />
              <Figure
                label="Giriş"
                value={entered}
                hint={counts.all ? enteredShare : undefined}
                tone="success"
              />
              <Figure label="Misafir · Üye" value={`${counts.guest} · ${counts.member}`} />
              <Figure
                label="Bilet gitmedi"
                value={counts.unsent}
                tone={counts.unsent ? 'warning' : undefined}
              />
            </div>
            <CapacityMeter registered={counts.all} capacity={event.capacity} />
            <GuestMemberSplit tickets={ws.tickets} />
          </OverviewCard>
        ) : null}
        <OverviewCard
          title={current ? 'Şimdi' : 'Program'}
          href={o.href('program')}
          className={ws.canTickets && !draft ? undefined : 'lg:col-span-1'}
        >
          <SessionNowNext
            sessions={ws.sessions}
            tickets={ws.tickets}
            ended={o.status === 'ended'}
          />
          {ws.canTickets && !draft ? (
            <SessionAttendance sessions={ws.sessions} tickets={ws.tickets} />
          ) : null}
          {!current && !next && ws.sessions.length ? (
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
              {ws.sessions.length} oturum
              {ws.sessions[0]?.startTime ? ` · ilk ${sessionClock(ws.sessions[0])}` : ''}
            </p>
          ) : null}
        </OverviewCard>
        {!draft && ws.canTickets ? (
          <div className="lg:col-span-3">
            <RosterCharts tickets={ws.tickets} />
          </div>
        ) : null}
        {ws.canTickets ? (
          <OverviewCard title="Son kayıtlar" href={o.href('participants')} linkLabel="Tümü">
            <LatestRegistrations
              tickets={ws.tickets}
              personById={ws.personById}
              participantsHref={o.href('participants')}
            />
          </OverviewCard>
        ) : null}
        <OverviewCard title="Paylaş">
          <ShareLinks event={event} />
        </OverviewCard>
        {!draft && ws.canMutate ? <ToDo o={o} /> : null}
        <OverviewCard title="Konum" className={event.mapImageUrl ? 'lg:col-span-2' : undefined}>
          <LocationBlock event={event} />
        </OverviewCard>
        {ws.canCertificates ? (
          <OverviewCard title="Sertifikalar" href={o.href('certificates')}>
            <CertificateFigures event={event} {...o.certificate} />
          </OverviewCard>
        ) : null}
        {o.hasContent || o.showsCompetition ? (
          <OverviewCard title="Dosyalar ve yarışma">
            <RelatedCounts
              event={event}
              competitors={ws.competitors.length}
              winners={o.winners}
              contentHref={o.hasContent ? o.href('content') : undefined}
              competitionHref={o.showsCompetition ? o.href('competition') : undefined}
            />
          </OverviewCard>
        ) : null}
        <OverviewCard
          title="Bilgiler"
          href={eventEditHref(event.id)}
          linkLabel="Düzenle"
          className="lg:col-span-3"
        >
          <EventEssentials
            event={event}
            seasonName={o.seasonName}
            registered={ws.canTickets ? ws.tickets.length : undefined}
            columns={3}
          />
        </OverviewCard>
      </div>
      <DescriptionAndFeedback o={o} />
    </div>
  );
}
