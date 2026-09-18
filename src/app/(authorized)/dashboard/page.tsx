'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import { sessionsApi, type SessionRow } from '@/lib/api/sessions';
import { isLeader, isPrivileged } from '@/lib/auth/groups';
import {
  displayCount,
  errorCount,
  eventActivity,
  eventsByMonth,
  okCount,
  sessionsByEvent,
  type CountState,
  type NamedCount,
} from '@/lib/ozet-stats';

const LOADING: CountState = { kind: 'loading' };

function failState(err: unknown): CountState {
  return errorCount(err instanceof ProblemError ? err.title : 'Özet yüklenemedi');
}

function MetricCard({
  href,
  label,
  state,
  tone = 'text-neutral-100',
  dot = 'bg-neutral-500',
}: {
  href: string;
  label: string;
  state: CountState;
  tone?: string;
  dot?: string;
}) {
  const value = displayCount(state);
  const title = state.kind === 'error' ? state.message : label;
  return (
    <Link
      href={href}
      title={title}
      className="flex items-center gap-2.5 rounded-md border border-white/5 bg-white/3 px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/5"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-3xs truncate text-neutral-500">{label}</p>
        <p
          className={`text-lg leading-tight font-semibold tabular-nums ${
            state.kind === 'error' ? 'text-red-300' : tone
          }`}
        >
          {value}
        </p>
      </div>
    </Link>
  );
}

function BarChart({ title, data, empty }: { title: string; data: NamedCount[]; empty: string }) {
  const max = Math.max(0, ...data.map((row) => row.count));
  return (
    <div>
      <h2 className="text-2xs mb-3 font-medium text-neutral-500">{title}</h2>
      {max === 0 ? (
        <p className="text-3xs py-6 text-center text-neutral-600">{empty}</p>
      ) : (
        <div className="flex h-24 items-end gap-1.5">
          {data.map((row) => (
            <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="bg-skylab-500/45 w-full rounded-sm"
                style={{ height: `${Math.max(8, (row.count / max) * 100)}%` }}
                title={`${row.label}: ${row.count}`}
              />
              <span className="text-4xs max-w-full truncate text-neutral-600">{row.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HorizontalBars({
  title,
  data,
  empty,
}: {
  title: string;
  data: NamedCount[];
  empty: string;
}) {
  const max = Math.max(0, ...data.map((row) => row.count));
  return (
    <div>
      <h2 className="text-2xs mb-3 font-medium text-neutral-500">{title}</h2>
      {data.length === 0 || max === 0 ? (
        <p className="text-3xs py-6 text-center text-neutral-600">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.label} className="space-y-1">
              <div className="text-3xs flex items-baseline justify-between gap-2 text-neutral-400">
                <span className="truncate">{row.label}</span>
                <span className="text-neutral-200 tabular-nums">{row.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="bg-skylab-500/70 h-full rounded-full"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  const [eventRows, setEventRows] = useState<CoreEvent[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEvents(LOADING);
      setSessions(LOADING);
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
      } catch (err) {
        if (cancelled) return;
        setEventRows([]);
        setEvents(failState(err));
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
    return <p className="text-sm text-neutral-500">Bu özet paneli yetkili üyelere açık.</p>;
  }

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
      tone: 'text-neutral-100',
      dot: 'bg-skylab-400 shadow-[0_0_6px] shadow-skylab-400/40',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Özet" description={user?.email} />
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <MetricCard key={card.href} {...card} />
        ))}
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
    </div>
  );
}
