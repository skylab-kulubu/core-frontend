'use client';

import { Button, SkylabMark } from '@skylab-kulubu/skylcn-ui';
import { CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

function salute(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Günaydın';
  if (hour >= 11 && hour < 17) return 'İyi günler';
  if (hour >= 17 && hour < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}

/**
 * The top of the dashboard: a greeting for the time of day, the date and one
 * line on where things stand. The time comes from the reader's clock, so the
 * server's render is allowed to differ.
 */
export function DashboardGreeting({
  firstName,
  now,
  summary,
}: {
  firstName?: string;
  now: Date;
  summary: ReactNode;
}) {
  return (
    <header className="border-border bg-card relative overflow-hidden rounded-xl border px-5 py-6 sm:px-7">
      <SkylabMark
        size={220}
        className="text-foreground pointer-events-none absolute -top-10 -right-10 opacity-[0.05]"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p
            suppressHydrationWarning
            className="text-3xs tracking-label text-subtle-foreground font-medium uppercase"
          >
            {now.toLocaleDateString('tr-TR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 suppressHydrationWarning className="text-foreground mt-1.5 text-2xl font-semibold">
            {salute(now.getHours())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{summary}</p>
        </div>
        <Button variant="primary" render={<Link href="/events/new" />}>
          <CalendarPlus /> Etkinlik oluştur
        </Button>
      </div>
    </header>
  );
}
