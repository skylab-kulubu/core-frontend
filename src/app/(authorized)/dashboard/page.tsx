'use client';

import { Notice } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useMemo, useState } from 'react';
import { NumbersSection, TodoSection, WeekSection } from '@/components/dashboard/HomeSections';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import { coreProblemMessage } from '@/lib/core-problems';
import { homeView } from '@/lib/dashboard/home';

type SummaryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; summary: DashboardSummary };

/**
 * The home page, top to bottom: what waits on the reader, the week from today,
 * then a few figures against the 30 days before. One request to core
 * (GET /v1/dashboard/summary), scoped by core to the reader's role and teams.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<SummaryState>({ kind: 'loading' });
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

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-8">
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
      ) : null}

      {loading ? (
        <TodoSection rows={[]} loading />
      ) : view?.todo ? (
        <TodoSection rows={view.todo} loading={false} />
      ) : null}

      {state.kind !== 'error' ? <WeekSection days={view?.week ?? []} loading={loading} /> : null}

      {view?.numbers && state.kind === 'ok' && state.summary.home?.compare ? (
        <NumbersSection rows={view.numbers} days={state.summary.home.compare.days} />
      ) : null}
    </div>
  );
}
