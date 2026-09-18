'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { NamedCount } from '@/lib/ozet-stats';
import { mixPercents } from '@/lib/panel-charts';

const MIX_TONES = ['bg-skylab-500', 'bg-amber-400', 'bg-emerald-400', 'bg-neutral-400'] as const;

const MIX_COLORS = ['#e0c8e5', '#fbbf24', '#34d399', '#a3a3a3'] as const;

export function BarChart({
  title,
  data,
  empty,
}: {
  title: string;
  data: readonly NamedCount[];
  empty: string;
}) {
  const max = Math.max(0, ...data.map((row) => row.count));
  return (
    <div>
      <h2 className="text-2xs mb-3 font-medium tracking-[0.18em] text-neutral-500 uppercase">
        {title}
      </h2>
      {max === 0 ? (
        <p className="text-3xs py-6 text-center text-neutral-500">{empty}</p>
      ) : (
        <div className="flex h-24 items-end gap-1.5">
          {data.map((row) => (
            <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="bg-skylab-500/45 w-full rounded-sm"
                style={{ height: `${Math.max(8, (row.count / max) * 100)}%` }}
                title={`${row.label}: ${row.count}`}
              />
              <span className="text-4xs max-w-full truncate text-neutral-500">{row.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HorizontalBars({
  title,
  data,
  empty,
}: {
  title: string;
  data: readonly NamedCount[];
  empty: string;
}) {
  const max = Math.max(0, ...data.map((row) => row.count));
  return (
    <div>
      <h2 className="text-2xs mb-3 font-medium tracking-[0.18em] text-neutral-500 uppercase">
        {title}
      </h2>
      {data.length === 0 || max === 0 ? (
        <p className="text-3xs py-6 text-center text-neutral-500">{empty}</p>
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

export function MixChart({
  title,
  data,
  empty,
}: {
  title: string;
  data: readonly NamedCount[];
  empty: string;
}) {
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const slices = mixPercents(data);
  const gradient = slices
    .reduce<{ parts: string[]; cursor: number }>(
      (acc, row, index) => {
        const next = acc.cursor + row.percent;
        acc.parts.push(`${MIX_COLORS[index % MIX_COLORS.length]} ${acc.cursor}% ${next}%`);
        acc.cursor = next;
        return acc;
      },
      { parts: [], cursor: 0 },
    )
    .parts.join(', ');
  return (
    <div>
      <h2 className="text-2xs mb-3 font-medium tracking-[0.18em] text-neutral-500 uppercase">
        {title}
      </h2>
      {total === 0 ? (
        <p className="text-3xs py-6 text-center text-neutral-500">{empty}</p>
      ) : (
        <div className="flex items-center gap-4">
          <div
            className="size-20 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
            aria-hidden
          />
          <ul className="min-w-0 space-y-1.5">
            {slices.map((row, index) => (
              <li key={row.label} className="text-2xs flex items-center gap-2 text-neutral-400">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${MIX_TONES[index % MIX_TONES.length]}`}
                />
                <span className="truncate">{row.label}</span>
                <span className="ml-auto text-neutral-200 tabular-nums">
                  {row.count} · {row.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  href,
  label,
  value,
  title,
  tone = 'text-neutral-100',
  dot = 'bg-neutral-500',
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
      className="flex items-center gap-2.5 rounded-md border border-white/5 bg-white/3 px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/5"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-3xs truncate text-neutral-500">{label}</p>
        <p
          className={`text-lg leading-tight font-semibold tabular-nums ${error ? 'text-red-300' : tone}`}
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
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">{title}</h2>
        {meta ? <p className="text-2xs mt-0.5 text-neutral-500">{meta}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
