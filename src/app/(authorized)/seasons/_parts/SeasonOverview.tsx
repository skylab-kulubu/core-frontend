'use client';

import { Card } from '@skylab-kulubu/skylcn-ui';
import { useMemo } from 'react';
import { SummaryStrip } from '@/components/chrome/ListPage';
import { BarChart } from '@/components/chrome/PanelChart';
import { ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { SeasonWheelCard } from '@/components/dashboard/SeasonWheelCard';
import type { EventStat } from '@/lib/api/dashboard';
import type { CoreEvent } from '@/lib/api/events';
import type { Season } from '@/lib/api/seasons';
import { seasonWheel } from '@/lib/dashboard/season';
import { SeasonBar } from './SeasonBar';
import { eventsByMonth, seasonFigures, seasonHref, seasonProgress } from './season-view';

const fmt = (n: number) => n.toLocaleString('tr-TR');

const DATE = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Istanbul',
});
const day = (iso?: string) => (iso ? DATE.format(new Date(iso)) : '—');

/**
 * The season's overview: its key facts, how far it is, the figures (each a way into the
 * events), the ring of its weeks and its events by month.
 */
export function SeasonOverview({
  season,
  events,
  stats,
  canEdit,
  now,
  onOpenEvents,
}: {
  season: Season;
  events: readonly CoreEvent[];
  /** core's event figures; null when they could not be read. */
  stats: readonly EventStat[] | null;
  canEdit: boolean;
  now: Date;
  onOpenEvents: () => void;
}) {
  const progress = seasonProgress(season, now);
  const figures = seasonFigures(events, stats, now);
  const months = useMemo(() => eventsByMonth(season, events), [season, events]);
  const wheel = useMemo(
    () =>
      season.startDate && season.endDate
        ? seasonWheel(
            season,
            events.map(({ id, name, ownerTeam, startDate, endDate }) => ({
              id,
              name,
              ownerTeam,
              startDate,
              endDate,
            })),
            now,
          )
        : null,
    [season, events, now],
  );
  const rate =
    figures.applications && figures.attendees !== null
      ? Math.round((figures.attendees / figures.applications) * 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <SummaryStrip
        label="Sezon sayıları"
        items={[
          {
            key: 'events',
            label: 'Etkinlik',
            value: fmt(figures.events),
            hint: (
              <span className="text-subtle-foreground text-[13px]/5">
                {figures.past} bitti · {figures.events - figures.past} sırada
              </span>
            ),
            onSelect: onOpenEvents,
          },
          ...(figures.applications !== null
            ? [
                {
                  key: 'applications',
                  label: 'Başvuru',
                  value: fmt(figures.applications),
                  onSelect: onOpenEvents,
                },
                {
                  key: 'attendees',
                  label: 'Katılım',
                  value: fmt(figures.attendees ?? 0),
                  hint:
                    rate !== null ? (
                      <span className="text-subtle-foreground text-[13px]/5">
                        Başvuranların %{rate}’i
                      </span>
                    ) : undefined,
                  onSelect: onOpenEvents,
                },
              ]
            : []),
        ]}
      />
      <div className="grid min-w-0 gap-4 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <ObjectEssentials
            items={[
              { label: 'Başlangıç', value: day(season.startDate) },
              { label: 'Bitiş', value: day(season.endDate) },
              { label: 'Durum', value: season.active ? 'Aktif' : 'Pasif' },
              {
                label: 'İlerleme',
                value: <SeasonBar progress={progress} />,
              },
            ]}
            editHref={canEdit ? seasonHref(season.id, 'ayarlar') : undefined}
            editName="Sezonu düzenle"
          />
          {months.length ? (
            <Card className="min-w-0 p-4">
              <BarChart
                title="Aylara göre etkinlik"
                data={months}
                empty="Bu sezonda etkinlik yok"
              />
            </Card>
          ) : null}
        </div>
        {wheel ? (
          <SeasonWheelCard className="min-w-0 lg:col-span-2" season={season} wheel={wheel} />
        ) : null}
      </div>
    </div>
  );
}
