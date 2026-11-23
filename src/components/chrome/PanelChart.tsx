'use client';

import { BarList, Skeleton } from '@skylab-kulubu/skylcn-ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, type ReactNode } from 'react';
import type { NamedCount } from '@/lib/ozet-stats';

// The chart library (recharts, ~110 KB gzip) loads only on a page that draws a chart, after the
// page itself; until then a box of the chart's height keeps the layout still. Pages that import
// only SectionHeading or MetricCard from here no longer carry it.
// A failed fetch reaches ChartBoundary (the app router's dynamic throws it) or `error` here (the
// pages loader, which the tests use); either way only the chart's place says so.
const Bars = dynamic(() => import('@skylab-kulubu/skylcn-ui/charts').then((m) => m.BarChart), {
  ssr: false,
  loading: ({ error }) => (error ? <ChartFailed /> : <ChartPlaceholder height={120} />),
});
const DonutChart = dynamic(
  () => import('@skylab-kulubu/skylcn-ui/charts').then((m) => m.DonutChart),
  {
    ssr: false,
    loading: ({ error }) => (error ? <ChartFailed /> : <ChartPlaceholder height={176} />),
  },
);

function ChartFailed() {
  return (
    <p role="alert" className="text-subtle-foreground py-6 text-center text-[13px]/5">
      Grafik yüklenemedi.
    </p>
  );
}

/**
 * A chart whose code could not be fetched (weak network, a release while the tab was open) shows
 * one line in its place; the page around it stays.
 */
export class ChartBoundary extends Component<
  { title: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div>
        <PanelTitle>{this.props.title}</PanelTitle>
        <ChartFailed />
      </div>
    );
  }
}

function ChartPlaceholder({ height }: { height: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

/** A small column chart of counts per label, such as events per month. */
export function BarChart({
  title,
  data,
  empty,
}: {
  title: string;
  data: readonly NamedCount[];
  empty: string;
}) {
  return (
    <ChartBoundary title={title}>
      <Bars
        title={<PanelTitle>{title}</PanelTitle>}
        framed={false}
        compact
        data={data.map((row) => ({ label: row.label, count: row.count }))}
        x="label"
        series={{ count: { label: title } }}
        emptyMessage={empty}
      />
    </ChartBoundary>
  );
}

/** Counts per label as horizontal bars, longest first as given. */
export function HorizontalBars({
  title,
  data,
  empty,
}: {
  title: string;
  data: readonly NamedCount[];
  empty: string;
}) {
  const hasData = data.some((row) => row.count > 0);
  return (
    <div>
      <PanelTitle>{title}</PanelTitle>
      {hasData ? (
        <BarList
          className="mt-3"
          highlightTop
          max={Math.max(...data.map((row) => row.count))}
          items={data.map((row) => ({ key: row.label, label: row.label, value: row.count }))}
        />
      ) : (
        <p className="text-subtle-foreground py-6 text-center text-[13px]/5">{empty}</p>
      )}
    </div>
  );
}

/** How a whole splits into a few parts, such as guests and members. */
export function MixChart({
  title,
  data,
  empty,
}: {
  title: string;
  data: readonly NamedCount[];
  empty: string;
}) {
  return (
    <ChartBoundary title={title}>
      <DonutChart
        title={<PanelTitle>{title}</PanelTitle>}
        framed={false}
        height={160}
        data={data.map((row) => ({ key: row.label, label: row.label, value: row.count }))}
        emptyMessage={empty}
      />
    </ChartBoundary>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <span className="text-subtle-foreground text-[13px]/5 font-medium">{children}</span>;
}

export function MetricCard({
  href,
  label,
  value,
  title,
  tone = 'text-foreground',
  dot = 'bg-subtle-foreground',
  error,
}: {
  href: string;
  label: string;
  value: string;
  title?: string;
  tone?: string;
  dot?: string;
  error?: boolean;
}) {
  return (
    <Link
      href={href}
      title={title ?? label}
      className="border-border-subtle bg-card hover:border-border hover:bg-accent flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-subtle-foreground truncate text-[13px]/5">{label}</p>
        <p
          className={`text-lg leading-tight font-semibold tabular-nums ${error ? 'text-destructive' : tone}`}
        >
          {value}
        </p>
      </div>
    </Link>
  );
}

export function SectionHeading({
  title,
  actions,
  meta,
}: {
  title: string;
  actions?: ReactNode;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {meta ? <p className="text-subtle-foreground mt-0.5 text-[13px]/5">{meta}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
