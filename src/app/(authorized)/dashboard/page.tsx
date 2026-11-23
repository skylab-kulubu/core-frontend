'use client';

import { Notice, Skeleton } from '@skylab-kulubu/skylcn-ui';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TodoCard, TodoLine, WeekCard } from '@/components/dashboard/HomeSections';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import { ticketsApi } from '@/lib/api/tickets';
import { canSeeSchedulingNav, isPrivileged } from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { homeView } from '@/lib/dashboard/home';
import { searchPages } from '@/lib/navigation/sidebar-nav';

// The charts and their library load on their own, after the strip
const HomeCharts = dynamic(() => import('@/components/dashboard/HomeCharts'), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

function ChartsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

type SummaryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; summary: DashboardSummary };

/**
 * The home page: a thin strip of what waits on the reader and the week, then
 * the graphic summary. One request to core (GET /v1/dashboard/summary), scoped
 * by core to the reader's role and teams.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<SummaryState>({ kind: 'loading' });
  // Whom the menu shows no Özet (door staff alone) lands on their doors, as the menu leads them
  const ownHome = user ? searchPages(user).some((page) => page.href === '/dashboard') : true;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (ownHome) return;
    let cancelled = false;
    ticketsApi
      .listDoorEvents()
      .then((events) => {
        if (cancelled || events.length === 0) return;
        setLeaving(true);
        router.replace('/qr');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ownHome, router]);
  // The server's clock is not the reader's, so dates wait for the browser
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNow(new Date());
    dashboardApi
      .summary()
      .then((summary) => {
        if (!cancelled) setState({ kind: 'ok', summary });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ kind: 'error', message: coreProblemMessage(err, 'Özet yüklenemedi') });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const groups = user?.groups;
  const view = useMemo(
    () => (state.kind === 'ok' && now ? homeView(state.summary, groups ?? [], now) : null),
    [state, groups, now],
  );
  const loading = state.kind === 'loading' || !now;
  const todo = view?.todo ?? null;
  // Nothing waiting: one line, and the week takes the row
  const todoCard = loading ? Boolean(groups && isPrivileged(groups)) : Boolean(todo?.length);

  if (leaving) return null;

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6">
      <PageHeader
        title="Özet"
        meta={
          now ? (
            <span className="text-muted-foreground text-sm">
              {now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          ) : null
        }
      />

      {state.kind === 'error' ? (
        <Notice tone="danger" title="Özet yüklenemedi">
          {state.message}
        </Notice>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {!loading && todo && todo.length === 0 ? <TodoLine /> : null}
          <div className={`grid min-w-0 gap-4 ${todoCard ? 'lg:grid-cols-2' : ''}`}>
            {todoCard ? <TodoCard rows={todo ?? []} loading={loading} /> : null}
            <WeekCard
              days={view?.week ?? []}
              loading={loading}
              linked={canSeeSchedulingNav(groups ?? [])}
            />
          </div>
        </div>
      )}

      {state.kind === 'ok' && view && now ? (
        <HomeCharts
          summary={state.summary}
          home={view.home}
          privileged={isPrivileged(groups ?? [])}
          now={now}
        />
      ) : state.kind === 'loading' ? (
        <ChartsSkeleton />
      ) : null}
    </div>
  );
}
