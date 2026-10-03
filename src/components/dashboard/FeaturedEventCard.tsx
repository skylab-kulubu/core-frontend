'use client';

import { Badge, Button, Card, Progress, Sparkline, StateCard } from '@skylab-kulubu/skylcn-ui';
import { CalendarPlus, DoorOpen, Ticket as TicketIcon } from 'lucide-react';
import Link from 'next/link';
import type { EventStat } from '@/lib/api/dashboard';
import { publicMediaUrl } from '@/lib/event-media';
import { fromNow, longDate } from './format';

/**
 * The event running now or coming next, first on the page: how full it is,
 * how applications are coming in, and on the day how many are through the door.
 */
export function FeaturedEventCard({
  stat,
  loading,
  canCreate,
  className,
}: {
  stat: EventStat | null;
  loading: boolean;
  canCreate: boolean;
  className?: string;
}) {
  if (loading || !stat) {
    return (
      <Card className={className}>
        <StateCard
          loading={loading}
          title={loading ? undefined : 'Planlanmış etkinlik yok'}
          description={loading ? undefined : 'Tarihi gelen bir etkinlik olunca burada öne çıkar.'}
        >
          {!loading && canCreate ? (
            <Button variant="primary" render={<Link href="/events/new" />}>
              <CalendarPlus /> Etkinlik oluştur
            </Button>
          ) : null}
        </StateCard>
      </Card>
    );
  }

  const event = stat;
  const live = stat.live;
  const count = stat.applications;
  const trend = stat.dailyApplications;
  const lastWeek = trend.slice(-7).reduce((sum, n) => sum + n, 0);
  const href = `/events/${encodeURIComponent(event.id)}`;

  return (
    <Card className={['gap-5 p-5', className].filter(Boolean).join(' ')}>
      <div className="flex gap-4">
        {event.coverImageUrl ? (
          <img
            src={publicMediaUrl(event.coverImageUrl)}
            alt=""
            className="border-border hidden size-20 shrink-0 rounded-lg border object-cover sm:block"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <Badge tone="success">Şu an sürüyor</Badge>
            ) : (
              <span className="text-3xs tracking-label text-subtle-foreground font-medium uppercase">
                Sıradaki etkinlik · {fromNow(event.startDate ?? '')}
              </span>
            )}
            <Badge tone="neutral">{event.ownerTeam}</Badge>
          </div>
          <h2 className="text-foreground mt-1.5 truncate text-xl font-semibold">
            <Link href={href} className="hover:underline">
              {event.name}
            </Link>
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {longDate(event.startDate ?? '')}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {event.capacity > 0 ? (
          <Progress
            label={`Başvuru · ${count} / ${event.capacity}`}
            value={count}
            max={event.capacity}
          />
        ) : (
          <div>
            <p className="text-secondary-foreground text-xs">Başvuru</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{count}</p>
          </div>
        )}
        {live ? (
          <Progress
            label="Kapıdan giren"
            value={count ? stat.checkedIn : 0}
            max={Math.max(count, 1)}
          />
        ) : (
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-secondary-foreground">Son 14 gün</span>
              <span className="text-subtle-foreground tabular-nums">son 7 günde {lastWeek}</span>
            </div>
            <Sparkline values={trend} className="mt-2" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" render={<Link href={href} />}>
          Etkinliğe git
        </Button>
        <Button render={<Link href={`${href}#participants`} />}>
          <TicketIcon /> Başvuranlar
        </Button>
        <Button render={<Link href={`/qr?eventId=${encodeURIComponent(event.id)}`} />}>
          <DoorOpen /> Kapı
        </Button>
      </div>
    </Card>
  );
}
