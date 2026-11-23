'use client';

import { Skeleton } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState } from 'react';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { BarChart, HorizontalBars, MixChart } from '@/components/chrome/PanelChart';
import { urlsApi, type ShortUrlStats } from '@/lib/api/urls';
import { coreProblemMessage } from '@/lib/core-problems';
import { statsCharts } from '@/lib/short-link-list';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const DAYS = 30;

/**
 * A link's clicks in the last 30 days, counted by day, channel, referring site and device
 * (core's summary); no single click is shown.
 */
export function LinkStats({ id }: { id: string }) {
  const [state, setState] = useState<
    | { id: string; stats: ShortUrlStats; error?: undefined }
    | { id: string; stats?: undefined; error: string }
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    urlsApi
      .stats(id, DAYS)
      .then((stats) => {
        if (!cancelled) setState({ id, stats });
      })
      .catch((err) => {
        if (!cancelled) setState({ id, error: coreProblemMessage(err, 'Tıklamalar yüklenemedi') });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = state?.id === id ? state : null;
  if (!current) {
    return (
      <ObjectCard title={`Son ${DAYS} gün`}>
        <Skeleton className="h-28 w-full" />
      </ObjectCard>
    );
  }
  if (current.error !== undefined) {
    return (
      <ObjectCard title={`Son ${DAYS} gün`}>
        <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
          {current.error}
        </p>
      </ObjectCard>
    );
  }
  const { stats } = current;
  const charts = statsCharts(stats);
  const scans = stats.scans > 0 ? ` · ${stats.scans} QR` : '';
  return (
    <>
      <ObjectCard
        title={`Son ${DAYS} gün`}
        action={
          <span className={`text-secondary-foreground tabular-nums ${TEXT_SECONDARY}`}>
            {stats.total} tıklama{scans}
          </span>
        }
      >
        <BarChart title="Günlük tıklama" data={charts.daily} empty="Bu dönemde tıklama yok" />
      </ObjectCard>
      {stats.total > 0 ? (
        <ObjectCard title="Nereden geldi">
          <HorizontalBars title="Kanal" data={charts.sources} empty="Kanal yok" />
          <HorizontalBars title="Gelen site" data={charts.referrers} empty="Site yok" />
          <MixChart title="Cihaz" data={charts.devices} empty="Cihaz bilgisi yok" />
        </ObjectCard>
      ) : null}
    </>
  );
}
