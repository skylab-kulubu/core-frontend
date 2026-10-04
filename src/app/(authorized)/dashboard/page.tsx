'use client';

import { Card, Meter, Notice, StatCard } from '@skylab-kulubu/skylcn-ui';
import { AreaChart } from '@skylab-kulubu/skylcn-ui/charts';
import {
  CalendarDays,
  Clock,
  Newspaper,
  ShieldAlert,
  Ticket as TicketIcon,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { BarChart, HorizontalBars, MixChart, SectionHeading } from '@/components/chrome/PanelChart';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { AttentionCard } from '@/components/dashboard/AttentionCard';
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { FeaturedEventCard } from '@/components/dashboard/FeaturedEventCard';
import { fromNow } from '@/components/dashboard/format';
import { GithubActivitySection } from '@/components/dashboard/GithubActivitySection';
import { MembersSection } from '@/components/dashboard/MembersSection';
import { SeasonWheelCard } from '@/components/dashboard/SeasonWheelCard';
import { useAuth } from '@/context/AuthContext';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import { dashboardApi, type DashboardSummary, type EventStat } from '@/lib/api/dashboard';
import type { CoreEvent } from '@/lib/api/events';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { sessionsApi, type SessionRow } from '@/lib/api/sessions';
import { isPrivileged } from '@/lib/auth/groups';
import {
  attentionItems,
  busiestDay,
  featuredEvent,
  monthCounts,
  upcomingStats,
} from '@/lib/dashboard/insights';
import { currentSeason, seasonWheel } from '@/lib/dashboard/season';
import { listStatus } from '@/lib/list-status';
import {
  displayCount,
  errorCount,
  okCount,
  sessionsByEvent,
  type CountState,
} from '@/lib/ozet-stats';
import { activeStatus } from '@/lib/status-chip';

const LOADING: CountState = { kind: 'loading' };

type SummaryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; summary: DashboardSummary };

function eventSubtitle(stat: EventStat): string {
  const date = stat.startDate
    ? new Date(stat.startDate).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  return [stat.ownerTeam, stat.location, date].filter(Boolean).join(' · ');
}

type SeasonState = { season: Season; events: CoreEvent[] } | null;

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

const sum = (stats: readonly EventStat[], pick: (stat: EventStat) => number) =>
  stats.reduce((total, stat) => total + pick(stat), 0);

export default function DashboardPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [state, setState] = useState<SummaryState>({ kind: 'loading' });
  const [news, setNews] = useState<CountState>(LOADING);
  const [sessions, setSessions] = useState<CountState>(LOADING);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  // Undefined while loading; null when there is no season to draw or it cannot be read
  const [season, setSeason] = useState<SeasonState | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ kind: 'loading' });
      let summary: DashboardSummary;
      try {
        summary = await dashboardApi.summary();
        if (cancelled) return;
        setState({ kind: 'ok', summary });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof ProblemError ? err.title : 'Özet yüklenemedi',
          });
        }
        return;
      }
      if (summary.ownerTeams.length === 0) return;
      void loadSeason(summary.ownerTeams);
      try {
        const rows = await sessionsApi.listAll();
        if (cancelled) return;
        setSessionRows(rows);
        setSessions(okCount(rows.length));
      } catch (err) {
        if (cancelled) return;
        setSessionRows([]);
        setSessions(errorCount(err instanceof ProblemError ? err.title : 'Oturumlar yüklenemedi'));
        setSessionsError(err instanceof ProblemError ? err.title : 'Oturumlar yüklenemedi');
      }
      if (privileged) {
        try {
          const page = await newsApi.list({ limit: 100 });
          if (!cancelled)
            setNews(okCount((page.items ?? []).filter((item) => Boolean(item.slug)).length));
        } catch (err) {
          if (!cancelled)
            setNews(errorCount(err instanceof ProblemError ? err.title : 'Duyurular yüklenemedi'));
        }
      }
    }
    // The season ring is a nicety: when seasons cannot be read the page keeps its month chart
    async function loadSeason(ownerTeams: string[]) {
      try {
        const picked = currentSeason(await seasonsApi.list());
        if (!picked) {
          if (!cancelled) setSeason(null);
          return;
        }
        const scope = new Set(ownerTeams);
        const events = (await seasonsApi.listEvents(picked.id)).filter(
          (event) => privileged || scope.has(event.ownerTeam),
        );
        if (!cancelled) setSeason({ season: picked, events });
      } catch {
        if (!cancelled) setSeason(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [privileged, user?.id]);

  const summary = state.kind === 'ok' ? state.summary : null;
  // Core decides what each person may see; with nothing in scope there is no dashboard for them
  if (
    summary &&
    summary.ownerTeams.length === 0 &&
    !summary.members &&
    !summary.membersUnavailable
  ) {
    return (
      <StateCard
        title="Bu özet paneli yetkili üyelere açık."
        description="Bir ekibin etkinliklerini yöneten ya da üyeleri görebilen kişiler içindir."
        Icon={ShieldAlert}
        tone="warning"
      />
    );
  }

  const now = new Date();
  const loading = state.kind === 'loading';
  const stats = summary?.eventStats ?? [];
  const upcoming = upcomingStats(stats, now);
  const current = stats.filter((stat) => stat.live || upcoming.includes(stat));
  const featured = featuredEvent(stats, now);
  const attention = attentionItems(stats, now);
  const firstName = user?.firstName?.trim();
  const daily = summary?.applications.daily ?? [];
  const busiest = busiestDay(daily, stats);
  const wheel = season ? seasonWheel(season.season, season.events, now) : null;
  const teams = summary?.ownerTeams ?? [];
  const greeting = loading
    ? 'Kulübün durumu yükleniyor…'
    : [
        featured
          ? featured.live
            ? `${featured.name} şu an sürüyor.`
            : `Sıradaki etkinlik ${featured.name}, ${fromNow(featured.startDate ?? '', now)}.`
          : 'Planlanmış bir etkinlik yok.',
        attention.length
          ? `${attention.length} etkinlikte eksik var.`
          : 'Önümüzdeki etkinliklerde eksik görünmüyor.',
      ].join(' ');

  const summaryCount = (value: number | undefined): CountState =>
    state.kind === 'loading'
      ? LOADING
      : state.kind === 'error'
        ? errorCount(state.message)
        : okCount(value ?? 0);

  const cards = [
    ...(summary?.members || summary?.membersUnavailable
      ? [
          {
            href: '/users',
            label: 'Aktif üye',
            state: summary.members
              ? okCount(summary.members.active)
              : errorCount('Şu an okunamıyor'),
            icon: Users,
            hint: 'Kayıtlı ve etkin',
          },
        ]
      : []),
    ...(privileged
      ? [
          {
            href: '/announcements',
            label: 'Duyurular',
            state: news,
            icon: Newspaper,
            hint: 'Yayındaki',
          },
        ]
      : []),
    {
      href: '/events',
      label: 'Etkinlikler',
      state: summaryCount(summary?.events.total),
      icon: CalendarDays,
      hint: summary ? `${summary.events.upcoming} yaklaşan` : 'Tüm dönemler',
    },
    {
      href: '/events',
      label: 'Oturumlar',
      state: sessions,
      icon: Clock,
      hint: 'Etkinlik günlerinde',
    },
    {
      href: '/events',
      label: 'Başvurular',
      state: summaryCount(sum(current, (stat) => stat.applications)),
      icon: TicketIcon,
      hint: 'Yaklaşan ve süren etkinliklerde',
      trend: daily.slice(-14).map((day) => day.count),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <DashboardGreeting firstName={firstName} summary={greeting} />

      {state.kind === 'error' ? (
        <Notice tone="danger" title="Özet yüklenemedi">
          {state.message}
        </Notice>
      ) : null}

      {teams.length && season && wheel ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <SeasonWheelCard className="lg:col-span-2" season={season.season} wheel={wheel} />
          <div className="flex flex-col gap-4">
            <FeaturedEventCard stat={featured} loading={loading} canCreate stacked />
            <AttentionCard items={attention} loading={loading} />
          </div>
        </div>
      ) : teams.length ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <FeaturedEventCard
            className="lg:col-span-2"
            stat={featured}
            loading={loading}
            canCreate
          />
          <AttentionCard items={attention} loading={loading} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="focus-visible:ring-ring rounded-xl outline-hidden focus-visible:ring-2"
          >
            <StatCard
              className="hover:bg-accent h-full transition-colors"
              label={card.label}
              icon={card.icon}
              value={card.state.kind === 'ok' ? card.state.count : displayCount(card.state)}
              hint={card.state.kind === 'error' ? card.state.message : card.hint}
              trend={card.state.kind === 'ok' ? card.trend : undefined}
            />
          </Link>
        ))}
      </div>

      {teams.length ? (
        <section aria-labelledby="events-and-applications" className="flex flex-col gap-4">
          <h2 id="events-and-applications" className="text-foreground text-base font-semibold">
            Etkinlikler ve başvurular
          </h2>
          <div className="grid gap-4 xl:grid-cols-3">
            <AreaChart
              className="xl:col-span-2"
              title="Başvurular"
              description={[
                privileged || teams.length > 3
                  ? 'Son 30 günde gelen bütün başvurular'
                  : `${teams.join(', ')} etkinliklerine son 30 günde gelenler`,
                busiest
                  ? `En yoğun gün ${dayLabel(busiest.date)}: ${busiest.count}${busiest.eventName ? `, en çok ${busiest.eventName}` : ''}`
                  : null,
              ]
                .filter(Boolean)
                .join('. ')}
              data={daily.map((day) => ({
                day: new Date(`${day.date}T12:00:00`).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                }),
                count: day.count,
              }))}
              x="day"
              series={{ count: { label: 'Başvuru' } }}
              loading={loading}
              emptyMessage="Bu dönemde başvuru yok"
            />
            <Card className="p-4">
              <MixChart
                title="Misafir / üye"
                data={[
                  { label: 'Misafir', count: sum(current, (stat) => stat.guests) },
                  { label: 'Üye', count: sum(current, (stat) => stat.members) },
                ]}
                empty="Yaklaşan etkinlikte başvuru yok"
              />
            </Card>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <SectionHeading title="Yaklaşan etkinlikler" meta={`${upcoming.length} kayıt`} />
              <ListPanel
                status={listStatus({
                  loading,
                  failed: state.kind === 'error',
                  rowCount: upcoming.length,
                  emptyMessage: 'Yaklaşan etkinlik yok',
                })}
                emptyDescription="Tarihi gelmiş etkinlikler burada durur."
              >
                {upcoming.map((stat) => (
                  <ListItem
                    key={stat.id}
                    href={`/events/${stat.id}`}
                    title={stat.name}
                    subtitle={eventSubtitle(stat)}
                    trailing={
                      stat.capacity > 0 ? (
                        <Meter
                          className="w-28"
                          label={`${stat.applications} / ${stat.capacity}`}
                          value={Math.min(stat.applications, stat.capacity)}
                          max={stat.capacity}
                          warnAt={0.9}
                          dangerAt={1}
                        />
                      ) : (
                        <StatusChip kind={activeStatus(stat.active)} />
                      )
                    }
                  />
                ))}
              </ListPanel>
            </section>
            <Card className="p-4">
              {sessionsError ? (
                <p className="text-destructive text-sm">{sessionsError}</p>
              ) : (
                <HorizontalBars
                  title="Oturumlar etkinliğe göre"
                  data={sessionsByEvent(sessionRows)}
                  empty="Oturum dağılımı yok"
                />
              )}
            </Card>
          </div>
          {season === null ? (
            <Card className="p-4">
              <BarChart
                title="Son altı ay etkinlik"
                data={monthCounts(summary?.events.byMonth ?? [])}
                empty="Bu aralıkta etkinlik tarihi yok"
              />
            </Card>
          ) : null}
        </section>
      ) : null}

      <MembersSection
        members={summary?.members ?? null}
        unavailable={summary?.membersUnavailable}
      />

      <GithubActivitySection />
    </div>
  );
}
