'use client';

import { Button, Card, Skeleton, Sparkline, cn } from '@skylab-kulubu/skylcn-ui';
import { ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChartBoundary } from '@/components/chrome/PanelChart';
import type { Ticket } from '@/lib/api/tickets';
import {
  recentRegistrations,
  registrationsByDay,
  rosterChartsOpen,
  rosterViewCounts,
  setRosterChartsOpen,
  type RosterView,
} from '@/lib/roster-insights';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

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
        label="Posta gitmedi"
        value={counts.unsent}
        tone="warning"
        active={view === 'unsent'}
        onClick={() => onView('unsent')}
      />
    </div>
  );
}

/**
 * The capacity over the figures (core docs/event-capacity.md): the active tickets against it,
 * and the waiting list, which opens its view. Nothing while there is neither.
 */
export function CapacityStrip({
  active,
  capacity,
  waitlisted,
  waitlistOpen,
  onWaitlist,
}: {
  active: number;
  capacity: number;
  waitlisted: number;
  waitlistOpen: boolean;
  onWaitlist: () => void;
}) {
  if (!(capacity > 0) && waitlisted === 0) return null;
  const share = capacity > 0 ? Math.min(100, (active / capacity) * 100) : 0;
  const over = capacity > 0 && active > capacity;
  const full = capacity > 0 && active >= capacity;
  return (
    <div className="bg-card border-border-subtle flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border px-3 py-3 sm:px-4">
      {capacity > 0 ? (
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <span className="text-subtle-foreground text-[13px]/5 font-medium">Kontenjan</span>
          <span
            className={`text-base font-semibold tabular-nums ${
              full ? 'text-warning' : 'text-foreground-strong'
            }`}
          >
            {active}/{capacity}
          </span>
          <span className="bg-accent block h-1.5 min-w-16 flex-1 overflow-hidden rounded-full">
            <span
              className={`block h-full rounded-full ${full ? 'bg-warning' : 'bg-skylab-400'}`}
              style={{ width: `${share}%` }}
            />
          </span>
          <span className="text-muted-foreground text-[13px]/5 whitespace-nowrap">
            {over ? `${active - capacity} fazla` : full ? 'Dolu' : `${capacity - active} yer`}
          </span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onWaitlist}
        aria-pressed={waitlistOpen}
        aria-label={`Bekleme listesi, ${waitlisted} kişi`}
        className={`hover:border-border-strong flex items-center gap-2 rounded-md border px-2.5 py-1 text-[13px]/5 transition-colors ${
          waitlistOpen ? 'border-skylab-400/60' : 'border-border-subtle'
        }`}
      >
        <span className="text-subtle-foreground font-medium">Bekleme listesi</span>
        <span
          className={`font-semibold tabular-nums ${
            waitlisted ? 'text-warning' : 'text-foreground-strong'
          }`}
        >
          {waitlisted}
        </span>
      </button>
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

/**
 * The charts under the list, folded away with one button; the choice stays on this device.
 */
export function RosterChartsSection({ tickets }: { tickets: readonly Ticket[] }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  useEffect(() => setOpen(rosterChartsOpen()), []);
  return (
    <section aria-label="Grafikler" className="space-y-2">
      <Button
        className={BUTTON_TEXT}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setRosterChartsOpen(!open);
        }}
      >
        <ChevronDown aria-hidden className={cn('transition-transform', !open && '-rotate-90')} />
        Grafikler
      </Button>
      {open ? (
        <div id={id}>
          <RosterCharts tickets={tickets} />
        </div>
      ) : null}
    </section>
  );
}
