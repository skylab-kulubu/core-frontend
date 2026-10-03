'use client';

import { Button, Card, StatCard } from '@skylab-kulubu/skylcn-ui';
import { AreaChart } from '@skylab-kulubu/skylcn-ui/charts';
import {
  CalendarDays,
  CalendarPlus,
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
import { AttentionCard } from '@/components/dashboard/AttentionCard';
import { FeaturedEventCard } from '@/components/dashboard/FeaturedEventCard';
import { GithubActivitySection } from '@/components/dashboard/GithubActivitySection';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { sessionsApi, type SessionRow } from '@/lib/api/sessions';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { isLeader, isPrivileged } from '@/lib/auth/groups';
import { eventListSubtitle } from '@/lib/events-view';
import { listStatus } from '@/lib/list-status';
import {
  displayCount,
  errorCount,
  eventsByMonth,
  okCount,
  sessionsByEvent,
  type CountState,
} from '@/lib/ozet-stats';
import { applicationsByDay, attentionItems, featuredEvent } from '@/lib/dashboard/insights';
import { ticketMix, upcomingEvents } from '@/lib/panel-charts';
import { activeStatus } from '@/lib/status-chip';

const LOADING: CountState = { kind: 'loading' };

function failState(err: unknown): CountState {
  return errorCount(err instanceof ProblemError ? err.title : 'Özet yüklenemedi');
}

export default function DashboardPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const privileged = isPrivileged(groups);
  const leader = isLeader(groups);
  const [users, setUsers] = useState<CountState>(LOADING);
  const [news, setNews] = useState<CountState>(LOADING);
  const [events, setEvents] = useState<CountState>(LOADING);
  const [sessions, setSessions] = useState<CountState>(LOADING);
  const [applicants, setApplicants] = useState<CountState>(LOADING);
  const [eventRows, setEventRows] = useState<CoreEvent[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsByEvent, setTicketsByEvent] = useState<ReadonlyMap<string, Ticket[]>>(new Map());
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEvents(LOADING);
      setSessions(LOADING);
      setApplicants(LOADING);
      setEventsError(null);
      setSessionsError(null);
      if (privileged) {
        setUsers(LOADING);
        setNews(LOADING);
      }
      try {
        const rows = await eventsApi.list();
        if (cancelled) return;
        setEventRows(rows);
        setEvents(okCount(rows.length));
        const current = featuredEvent(rows);
        const sample = upcomingEvents(rows, new Date(), 8);
        const pool = [
          ...(current && !sample.includes(current.event) ? [current.event] : []),
          ...(sample.length ? sample : rows.slice(0, 8)),
        ];
        const nested = await Promise.all(
          pool.map((event) => ticketsApi.listByEvent(event.id).catch(() => [] as Ticket[])),
        );
        if (cancelled) return;
        const flat = nested.flat();
        setTickets(flat);
        setTicketsByEvent(new Map(pool.map((event, index) => [event.id, nested[index] ?? []])));
        setApplicants(okCount(flat.length));
      } catch (err) {
        if (cancelled) return;
        setEventRows([]);
        setTickets([]);
        setTicketsByEvent(new Map());
        setEvents(failState(err));
        setApplicants(failState(err));
        setEventsError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi');
      }
      try {
        const rows = await sessionsApi.listAll();
        if (cancelled) return;
        setSessionRows(rows);
        setSessions(okCount(rows.length));
      } catch (err) {
        if (cancelled) return;
        setSessionRows([]);
        setSessions(failState(err));
        setSessionsError(err instanceof ProblemError ? err.title : 'Oturumlar yüklenemedi');
      }
      if (privileged) {
        try {
          const people = await identityApi.listUsers();
          if (!cancelled) setUsers(okCount(people.length));
        } catch (err) {
          if (!cancelled) setUsers(failState(err));
        }
        try {
          const page = await newsApi.list({ limit: 100 });
          if (!cancelled) {
            setNews(okCount((page.items ?? []).filter((item) => Boolean(item.slug)).length));
          }
        } catch (err) {
          if (!cancelled) setNews(failState(err));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [privileged, user?.id]);

  if (!privileged && !leader) {
    return (
      <StateCard
        title="Bu özet paneli yetkili üyelere açık."
        description="YK, kurul veya ekip lideri rolü gerekir."
        Icon={ShieldAlert}
        tone="warning"
      />
    );
  }

  const now = new Date();
  const soon = upcomingEvents(eventRows, now);
  const featured = featuredEvent(eventRows, now);
  const featuredTickets = featured ? (ticketsByEvent.get(featured.event.id) ?? []) : [];
  const loadingEvents = events.kind === 'loading';
  const daily = applicationsByDay(tickets, 30, now);
  const firstName = user?.firstName?.trim();
  const cards = [
    ...(privileged
      ? [
          {
            href: '/users',
            label: 'Kullanıcılar',
            state: users,
            icon: Users,
            hint: 'Kayıtlı hesap',
          },
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
      state: events,
      icon: CalendarDays,
      hint: 'Tüm dönemler',
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
      state: applicants,
      icon: TicketIcon,
      hint: 'Yaklaşan etkinliklerde',
      trend: daily.slice(-14),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={firstName ? `Merhaba, ${firstName}` : 'Özet'}
        description={now.toLocaleDateString('tr-TR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        actions={
          <Button variant="primary" render={<Link href="/events/new" />}>
            <CalendarPlus /> Etkinlik oluştur
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <FeaturedEventCard
          className="lg:col-span-2"
          featured={featured}
          tickets={featuredTickets}
          loading={loadingEvents}
          canCreate
        />
        <AttentionCard
          items={attentionItems(eventRows, ticketsByEvent, now)}
          loading={loadingEvents}
        />
      </div>

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

      <GithubActivitySection />

      <section aria-labelledby="events-and-applications" className="flex flex-col gap-4">
        <h2 id="events-and-applications" className="text-foreground text-base font-semibold">
          Etkinlikler ve başvurular
        </h2>
        <div className="grid gap-4 xl:grid-cols-3">
          <AreaChart
            className="xl:col-span-2"
            title="Başvurular"
            description="Yaklaşan etkinliklere son 30 günde gelenler"
            data={daily.map((count, index) => ({
              day: new Date(
                now.getTime() - (daily.length - 1 - index) * 86400000,
              ).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
              count,
            }))}
            x="day"
            series={{ count: { label: 'Başvuru' } }}
            loading={loadingEvents}
            emptyMessage="Bu dönemde başvuru yok"
          />
          <Card className="p-4">
            <MixChart
              title="Misafir / üye"
              data={ticketMix(tickets)}
              empty="Yaklaşan etkinlikte başvuru yok"
            />
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            {eventsError ? (
              <p className="text-destructive text-sm">{eventsError}</p>
            ) : (
              <BarChart
                title="Son altı ay etkinlik"
                data={eventsByMonth(eventRows)}
                empty="Bu aralıkta etkinlik tarihi yok"
              />
            )}
          </Card>
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
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading title="Yaklaşan etkinlikler" meta={`${soon.length} kayıt`} />
        <ListPanel
          status={listStatus({
            loading: loadingEvents,
            failed: Boolean(eventsError),
            rowCount: soon.length,
            emptyMessage: 'Yaklaşan etkinlik yok',
          })}
          emptyDescription="Tarihi gelmiş etkinlikler burada durur."
        >
          {soon.map((event) => (
            <ListItem
              key={event.id}
              href={`/events/${event.id}`}
              title={event.name}
              subtitle={eventListSubtitle(event)}
              trailing={<StatusChip kind={activeStatus(event.active)} />}
            />
          ))}
        </ListPanel>
      </section>
    </div>
  );
}
