'use client';

import { Card, CardDescription, CardHeader, CardTitle, SkylabMark } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import { useState } from 'react';
import type { Season } from '@/lib/api/seasons';
import type { SeasonWheel } from '@/lib/dashboard/season';

const SIZE = 360;
const C = SIZE / 2;
const R = 122;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

/**
 * The season as a ring of its weeks: events sit on the week they start in,
 * filled once they are over, and a marker shows today. It reads the same on a
 * quiet week as on a busy one, since it never depends on fresh activity.
 */
export function SeasonWheelCard({
  season,
  wheel,
  className,
}: {
  season: Season;
  wheel: SeasonWheel;
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const angle = (week: number) => -Math.PI / 2 + (week / wheel.weeks) * Math.PI * 2;
  const at = (week: number, radius: number) => ({
    x: C + radius * Math.cos(angle(week)),
    y: C + radius * Math.sin(angle(week)),
  });

  const nowWeek = Math.min(Math.max(wheel.now, 0), wheel.weeks);
  const elapsed = nowWeek / wheel.weeks;
  const done = wheel.events.filter((event) => event.past).length;
  const currentWeek = Math.floor(wheel.now) + 1;
  const where = wheel.ended
    ? 'bitti'
    : wheel.now < 0
      ? 'henüz başlamadı'
      : `${currentWeek}. hafta / ${wheel.weeks}`;
  const active = wheel.events.find((event) => event.id === hovered) ?? null;

  // The elapsed part of the ring as an arc path (a full circle would collapse, so stop short)
  const arcEnd = at(Math.min(nowWeek, wheel.weeks - 0.001), R);
  const arc =
    nowWeek > 0
      ? `M ${C} ${C - R} A ${R} ${R} 0 ${elapsed > 0.5 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y}`
      : null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Sezon</CardTitle>
          <CardDescription>
            {season.name} · {where}
          </CardDescription>
        </div>
        <div className="text-2xs text-subtle-foreground flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="bg-skylab-500 size-2 rounded-full" aria-hidden /> geçti
          </span>
          <span className="flex items-center gap-1.5">
            <span className="border-skylab-500 size-2 rounded-full border-[1.5px]" aria-hidden />
            sırada
          </span>
        </div>
      </CardHeader>

      <div className="relative mx-auto w-full max-w-[480px] px-4">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block h-auto w-full overflow-visible">
          <title>{`${season.name}: ${wheel.events.length} etkinlik, ${done} tanesi geçti`}</title>
          <circle cx={C} cy={C} r={R} fill="none" className="stroke-border" />
          {Array.from({ length: wheel.weeks }, (_, week) => {
            const inner = at(week, R - 5);
            const outer = at(week, R + 5);
            return (
              <line
                key={week}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                className="stroke-border-strong"
              />
            );
          })}
          {arc ? (
            <path
              d={arc}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              className="stroke-skylab-500/60"
            />
          ) : null}
          {wheel.months.map((month) => {
            const p = at(month.week, R - 22);
            return (
              <text
                key={`${month.label}-${month.week}`}
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="fill-subtle-foreground font-mono text-[11px]"
              >
                {month.label}
              </text>
            );
          })}
          {!wheel.ended && wheel.now >= 0 ? (
            <g>
              <line
                x1={at(nowWeek, R - 12).x}
                y1={at(nowWeek, R - 12).y}
                x2={at(nowWeek, R + 8).x}
                y2={at(nowWeek, R + 8).y}
                strokeWidth={1.5}
                className="stroke-foreground"
              />
              <circle
                cx={at(nowWeek, R).x}
                cy={at(nowWeek, R).y}
                r={4.5}
                className="fill-skylab-300 motion-safe:animate-pulse"
              />
            </g>
          ) : null}
          {wheel.events.map((event) => {
            const p = at(event.week + 0.5, R + 16 + event.stack * 14);
            const on = hovered === event.id;
            return (
              <Link
                key={event.id}
                href={`/events/${encodeURIComponent(event.id)}`}
                aria-label={`${event.name}, ${event.ownerTeam}, ${shortDate(event.startDate)}`}
                onMouseEnter={() => setHovered(event.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(event.id)}
                onBlur={() => setHovered(null)}
                className="outline-hidden"
              >
                <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={on ? 6 : 4.5}
                  strokeWidth={1.5}
                  className={
                    event.past ? 'fill-skylab-500 stroke-skylab-500' : 'fill-card stroke-skylab-500'
                  }
                />
                {on ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={10}
                    fill="none"
                    className="stroke-ring"
                    strokeWidth={2}
                  />
                ) : null}
              </Link>
            );
          })}
        </svg>
        <SkylabMark
          size={92}
          className="text-skylab-500 pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_18px_rgb(224_200_229/0.35)]"
        />
      </div>

      <div className="text-muted-foreground min-h-10 px-6 pb-5 text-xs" aria-live="polite">
        {active ? (
          <>
            <span className="text-foreground text-sm font-medium">{active.name}</span>
            <span className="text-subtle-foreground block font-mono text-[11px]">
              {active.ownerTeam} · {shortDate(active.startDate)} · {active.week + 1}. hafta
            </span>
          </>
        ) : wheel.events.length ? (
          <span>
            {wheel.events.length} etkinlik · {done} tanesi geçti
            {wheel.events.length - done ? ` · ${wheel.events.length - done} tanesi sırada` : ''}
          </span>
        ) : (
          <span>Bu sezona bağlı etkinlik yok</span>
        )}
      </div>
    </Card>
  );
}
