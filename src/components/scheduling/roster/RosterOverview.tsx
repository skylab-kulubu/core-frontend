'use client';

import { Card, Skeleton, Sparkline } from '@skylab-kulubu/skylcn-ui';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { ChartBoundary } from '@/components/chrome/PanelChart';
import type { Ticket } from '@/lib/api/tickets';
import {
  recentRegistrations,
  registrationsByDay,
  rosterViewCounts,
  type RosterView,
} from '@/lib/roster-insights';

const percent = (part: number, whole: number) =>
  whole ? `%${Math.round((part / whole) * 100)}` : '—';

// The chart library loads after the page, as in PanelChart: the list is usable before it comes,
// and a chart that cannot be fetched says so in its place (ChartBoundary) while the page stays.
function ChartPlaceholder({ height }: { height: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

function ChartFailed() {
  return (
    <p role="alert" className="text-subtle-foreground py-6 text-center text-[13px]/5">
      Grafik yüklenemedi.
    </p>
  );
}

const AreaChart = dynamic(
  () => import('@skylab-kulubu/skylcn-ui/charts').then((m) => m.AreaChart),
  {
    ssr: false,
    loading: ({ error }) => (error ? <ChartFailed /> : <ChartPlaceholder height={180} />),
  },
);
const DonutChart = dynamic(
  () => import('@skylab-kulubu/skylcn-ui/charts').then((m) => m.DonutChart),
  {
    ssr: false,
    loading: ({ error }) => (error ? <ChartFailed /> : <ChartPlaceholder height={150} />),
  },
);

function ChartTitle({ children }: { children: ReactNode }) {
  return <span className="text-subtle-foreground text-[13px]/5 font-medium">{children}</span>;
}

/** A figure that is also a way into its view of the list. */
function Tile({
  label,
  value,
  hint,
  active,
  tone,
  onClick,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  active?: boolean;
  tone?: 'warning';
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`bg-card hover:border-border-strong flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors sm:p-4 ${
        active ? 'border-skylab-400/60' : 'border-border-subtle'
      }`}
    >
      <span className="text-subtle-foreground text-[13px]/5 font-medium">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={`text-xl leading-none font-semibold tabular-nums sm:text-2xl ${
            tone === 'warning' && value !== 0 ? 'text-warning' : 'text-foreground-strong'
          }`}
        >
          {value}
        </span>
        {hint ? <span className="text-muted-foreground truncate text-[13px]/5">{hint}</span> : null}
      </span>
      {children ? <span className="mt-auto block min-h-6">{children}</span> : null}
    </button>
  );
}

/** Four figures over the list, each opening its view. */
export function RosterTiles({
  tickets,
  view,
  onView,
}: {
  tickets: readonly Ticket[];
  /** The view shown; null when the list shows none of these (the cancelled tickets). */
  view: RosterView | null;
  onView: (view: RosterView) => void;
}) {
  const counts = rosterViewCounts(tickets);
  const days = registrationsByDay(tickets, new Date(), 14);
  const week = recentRegistrations(tickets);
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Tile
        label="Kayıt"
        value={counts.all}
        hint={week ? `son 7 gün +${week}` : undefined}
        active={view === 'all'}
        onClick={() => onView('all')}
      >
        <Sparkline values={days.map((day) => day.count)} className="h-6 w-full" />
      </Tile>
      <Tile
        label="Giriş yaptı"
        value={counts['checked-in']}
        hint={percent(counts['checked-in'], counts.all)}
        active={view === 'checked-in'}
        onClick={() => onView('checked-in')}
      >
        <span className="bg-accent block h-1.5 overflow-hidden rounded-full">
          <span
            className="bg-success block h-full rounded-full"
            style={{
              width: counts.all ? `${(counts['checked-in'] / counts.all) * 100}%` : 0,
            }}
          />
        </span>
      </Tile>
      <Tile
        label="Misafir · Üye"
        value={`${counts.guest} · ${counts.member}`}
        active={view === 'guest' || view === 'member'}
        onClick={() => onView(view === 'guest' ? 'member' : 'guest')}
      >
        <span className="bg-chart-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          <span
            className="bg-chart-1 block h-full"
            style={{ width: counts.all ? `${(counts.guest / counts.all) * 100}%` : 0 }}
          />
        </span>
      </Tile>
      <Tile
        label="Bilet gitmedi"
        value={counts.unsent}
        tone="warning"
        active={view === 'unsent'}
        onClick={() => onView('unsent')}
      />
    </div>
  );
}

/** Registrations over time beside the two splits, in one card. */
export function RosterCharts({ tickets }: { tickets: readonly Ticket[] }) {
  const counts = rosterViewCounts(tickets);
  const days = registrationsByDay(tickets);
  return (
    <Card className="grid gap-6 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <ChartBoundary title="Kayıtlar">
        <AreaChart
          title={<ChartTitle>Kayıtlar</ChartTitle>}
          framed={false}
          height={180}
          data={days.map((day) => ({ label: day.label, total: day.total }))}
          x="label"
          series={{ total: { label: 'Toplam kayıt' } }}
          emptyMessage="Kayıt yok"
        />
      </ChartBoundary>
      <ChartBoundary title="Kapı">
        <DonutChart
          title={<ChartTitle>Kapı</ChartTitle>}
          framed={false}
          height={150}
          data={[
            { key: 'in', label: 'Giriş yaptı', value: counts['checked-in'] },
            { key: 'waiting', label: 'Gelmedi', value: counts.waiting },
          ]}
          emptyMessage="Kayıt yok"
        />
      </ChartBoundary>
      <ChartBoundary title="Misafir / üye">
        <DonutChart
          title={<ChartTitle>Misafir / üye</ChartTitle>}
          framed={false}
          height={150}
          data={[
            { key: 'guest', label: 'Misafir', value: counts.guest },
            { key: 'member', label: 'Üye', value: counts.member },
          ]}
          emptyMessage="Kayıt yok"
        />
      </ChartBoundary>
    </Card>
  );
}
