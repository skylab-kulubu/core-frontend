'use client';

import { Button, SkylabMark } from '@skylab-kulubu/skylcn-ui';
import { CalendarPlus } from 'lucide-react';
import { useNewEvent } from '@/components/scheduling/NewEventProvider';
import { useEffect, useState, type ReactNode } from 'react';
import { greetingFor } from '@/lib/dashboard/daylight';

/**
 * The top of the dashboard: a greeting for the time of day, by the sun over
 * Istanbul, the date and one line on where things stand. Both come from the
 * reader's clock once the page runs, and stay current while it is open.
 */
export function DashboardGreeting({
  firstName,
  summary,
}: {
  firstName?: string;
  summary: ReactNode;
}) {
  // The server's clock is not the reader's, so the greeting waits for the browser
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { open: openNewEvent, canCreate } = useNewEvent();
  return (
    <header className="border-border bg-card relative overflow-hidden rounded-xl border px-5 py-6 sm:px-7">
      <SkylabMark
        size={220}
        className="text-foreground pointer-events-none absolute -top-10 -right-10 opacity-[0.05]"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-3xs tracking-label text-subtle-foreground min-h-4 font-medium uppercase">
            {now
              ? now.toLocaleDateString('tr-TR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : null}
          </p>
          <h1 className="text-foreground mt-1.5 text-2xl font-semibold">
            {now ? greetingFor(now) : 'Merhaba'}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{summary}</p>
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={openNewEvent}>
            <CalendarPlus /> Etkinlik oluştur
          </Button>
        ) : null}
      </div>
    </header>
  );
}
