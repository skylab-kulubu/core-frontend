'use client';

import { DoorOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { ticketsApi, type DoorEvent } from '@/lib/api/tickets';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventDoorHref } from '@/lib/event-workspace';
import { listStatus } from '@/lib/list-status';

const DAY = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

function when(event: DoorEvent): string | undefined {
  if (!event.startDate) return event.location || undefined;
  const date = new Date(event.startDate);
  const day = Number.isNaN(date.getTime()) ? '' : DAY.format(date);
  return [day, event.location].filter(Boolean).join(' · ') || undefined;
}

/** The doors the person staffs; with one, straight to it. */
export function DoorEventList() {
  const router = useRouter();
  const [events, setEvents] = useState<DoorEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ticketsApi
      .listDoorEvents()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length === 1) router.replace(eventDoorHref(rows[0].id));
        else setEvents(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(coreProblemMessage(err, 'Etkinlikler yüklenemedi'));
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı" />
        <div role="alert">
          <StateCard title={error} tone="danger" />
        </div>
      </div>
    );
  }
  if (!events) return <StateCard title="Yükleniyor…" isLoading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Kapı" />
      <ListPanel
        status={listStatus({
          loading: false,
          rowCount: events.length,
          emptyMessage: 'Kapı görevin olan etkinlik yok',
        })}
        emptyIcon={DoorOpen}
      >
        {events.map((event) => (
          <ListItem
            key={event.id}
            href={eventDoorHref(event.id)}
            title={event.name}
            subtitle={when(event)}
          />
        ))}
      </ListPanel>
    </div>
  );
}
