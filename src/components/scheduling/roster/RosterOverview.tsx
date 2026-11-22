'use client';

import { Card, ProportionBar, Sparkline } from '@skylab-kulubu/skylcn-ui';
import { AreaChart, DonutChart } from '@skylab-kulubu/skylcn-ui/charts';
import type { ReactNode } from 'react';
import type { Ticket } from '@/lib/api/tickets';
import {
  recentRegistrations,
  registrationsByDay,
  rosterViewCounts,
  type RosterView,
} from '@/lib/roster-insights';

const percent = (part: number, whole: number) =>
  whole ? `%${Math.round((part / whole) * 100)}` : '—';

function ChartTitle({ children }: { children: ReactNode }) {
  return <span className="text-2xs text-subtle-foreground font-medium">{children}</span>;
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
      <span className="text-2xs text-subtle-foreground font-medium">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={`text-xl leading-none font-semibold tabular-nums sm:text-2xl ${
            tone === 'warning' && value !== 0 ? 'text-warning' : 'text-foreground-strong'
          }`}
        >
          {value}
        </span>
        {hint ? <span className="text-2xs text-muted-foreground truncate">{hint}</span> : null}
      </span>
      {children ? <span className="mt-auto block min-h-6">{children}</span> : null}
    </button>
  );
}

/** Direction A: four figures over the list, each opening its view. */
export function RosterTiles({
  tickets,
  view,
  onView,
}: {
  tickets: readonly Ticket[];
  view: RosterView;
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

/** Direction A: registrations over time beside the two splits, in one card. */
export function RosterCharts({ tickets }: { tickets: readonly Ticket[] }) {
  const counts = rosterViewCounts(tickets);
  const days = registrationsByDay(tickets);
  return (
    <Card className="grid gap-6 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <AreaChart
        title={<ChartTitle>Kayıtlar</ChartTitle>}
        framed={false}
        height={180}
        data={days.map((day) => ({ label: day.label, total: day.total }))}
        x="label"
        series={{ total: { label: 'Toplam kayıt' } }}
        emptyMessage="Kayıt yok"
      />
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
    </Card>
  );
}

/** Direction B: one quiet row of figures with small charts; the full charts open below it. */
export function RosterStrip({
  tickets,
  chartsOpen,
  onCharts,
}: {
  tickets: readonly Ticket[];
  chartsOpen: boolean;
  onCharts: () => void;
}) {
  const counts = rosterViewCounts(tickets);
  const days = registrationsByDay(tickets, new Date(), 14);
  const week = recentRegistrations(tickets);
  return (
    <div className="border-border-subtle flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3">
      <Figure label="Kayıt" value={counts.all} hint={week ? `+${week} bu hafta` : undefined}>
        <Sparkline values={days.map((day) => day.count)} className="h-5 w-20" />
      </Figure>
      <Figure
        label="Giriş"
        value={counts['checked-in']}
        hint={percent(counts['checked-in'], counts.all)}
      >
        <span className="bg-accent block h-1.5 w-20 overflow-hidden rounded-full">
          <span
            className="bg-success block h-full rounded-full"
            style={{
              width: counts.all ? `${(counts['checked-in'] / counts.all) * 100}%` : 0,
            }}
          />
        </span>
      </Figure>
      <div className="min-w-48 flex-1 sm:max-w-64">
        <ProportionBar
          segments={[
            { key: 'guest', label: 'Misafir', value: counts.guest },
            { key: 'member', label: 'Üye', value: counts.member },
          ]}
        />
      </div>
      {counts.unsent ? <Figure label="Bilet gitmedi" value={counts.unsent} tone="warning" /> : null}
      <button
        type="button"
        onClick={onCharts}
        aria-expanded={chartsOpen}
        className="text-2xs text-skylab-300 hover:bg-accent ml-auto rounded-md px-2 py-1"
      >
        {chartsOpen ? 'Grafikleri gizle' : 'Grafikler'}
      </button>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  children,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'warning';
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-3xs text-subtle-foreground">{label}</p>
        <p className="flex items-baseline gap-1.5">
          <span
            className={`text-lg leading-tight font-semibold tabular-nums ${
              tone === 'warning' ? 'text-warning' : 'text-foreground-strong'
            }`}
          >
            {value}
          </span>
          {hint ? <span className="text-3xs text-muted-foreground">{hint}</span> : null}
        </p>
      </div>
      {children}
    </div>
  );
}
