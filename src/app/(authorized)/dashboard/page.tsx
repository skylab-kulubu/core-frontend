'use client';

import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import {
  BarChart,
  HorizontalBars,
  MetricCard,
  MixChart,
  SectionHeading,
} from '@/components/chrome/PanelChart';
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
  eventActivity,
  eventsByMonth,
  okCount,
  sessionsByEvent,
  type CountState,
} from '@/lib/ozet-stats';
import { ticketCheckInMix, ticketMix, upcomingEvents } from '@/lib/panel-charts';
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
        const sample = upcomingEvents(rows, new Date(), 8);
        const pool = sample.length ? sample : rows.slice(0, 8);
        const nested = await Promise.all(
          pool.map((event) => ticketsApi.listByEvent(event.id).catch(() => [] as Ticket[])),
        );
        if (cancelled) return;
        const flat = nested.flat();
        setTickets(flat);
        setApplicants(okCount(flat.length));
      } catch (err) {
        if (cancelled) return;
        setEventRows([]);
        setTickets([]);
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

  const soon = upcomingEvents(eventRows);
  const cards = [
    ...(privileged
      ? [
          {
            href: '/users',
            label: 'Kullanıcılar',
            state: users,
            dot: 'bg-neutral-500',
          },
          {
            href: '/announcements',
            label: 'Duyurular',
            state: news,
            dot: 'bg-skylab-400 shadow-[0_0_6px] shadow-skylab-400/40',
          },
        ]
      : []),
    {
      href: '/events',
      label: 'Etkinlikler',
      state: events,
      dot: 'bg-neutral-500',
    },
    {
      href: '/sessions',
      label: 'Oturumlar',
      state: sessions,
      dot: 'bg-skylab-400 shadow-[0_0_6px] shadow-skylab-400/40',
    },
    {
      href: '/events',
      label: 'Başvurular',
      state: applicants,
      dot: 'bg-amber-400 shadow-[0_0_6px] shadow-amber-400/40',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Özet" description={user?.email} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {cards.map((card) => (
          <MetricCard
            key={`${card.href}-${card.label}`}
            href={card.href}
            label={card.label}
            value={displayCount(card.state)}
            title={card.state.kind === 'error' ? card.state.message : card.label}
            dot={card.dot}
            error={card.state.kind === 'error'}
          />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <MixChart
          title="Misafir / üye"
          data={ticketMix(tickets)}
          empty="Yaklaşan etkinlikte başvuru yok"
        />
        <MixChart
          title="Kapı durumu"
          data={ticketCheckInMix(tickets)}
          empty="Kapı kaydı henüz yok"
        />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          {eventsError ? (
            <p className="text-sm text-red-300">{eventsError}</p>
          ) : (
            <BarChart
              title="Son altı ay etkinlik"
              data={eventsByMonth(eventRows)}
              empty="Bu aralıkta etkinlik tarihi yok"
            />
          )}
        </div>
        <div>
          {sessionsError ? (
            <p className="text-sm text-red-300">{sessionsError}</p>
          ) : (
            <HorizontalBars
              title="Oturumlar etkinliğe göre"
              data={sessionsByEvent(sessionRows)}
              empty="Oturum dağılımı yok"
            />
          )}
        </div>
      </div>
      {eventsError ? null : (
        <HorizontalBars
          title="Etkinlik durumu"
          data={eventActivity(eventRows)}
          empty="Etkinlik durumu yok"
        />
      )}
      <div className="space-y-3">
        <SectionHeading title="Yaklaşan etkinlikler" meta={`${soon.length} kayıt`} />
        <ListPanel
          status={listStatus({
            loading: events.kind === 'loading',
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
      </div>
    </div>
  );
}
