'use client';

import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { EmptyState } from '@/components/chrome/PageState';
import type { RaffleSummary } from '@/lib/api/raffles';
import type { EventSession } from '@/lib/api/sessions';
import { listStatus } from '@/lib/list-status';
import { formatRaffleTime, raffleCountsLine, raffleCriteriaLine, raffleHref } from './raffle-copy';

/** The Event's raffles so far, newest first; each opens its result. */
export function RaffleHistory({
  eventId,
  raffles,
  loading,
  failed,
  onRetry,
  sessions,
}: {
  eventId: string;
  raffles: readonly RaffleSummary[];
  loading: boolean;
  failed: string | null;
  onRetry: () => void;
  sessions: readonly Pick<EventSession, 'id' | 'title'>[];
}) {
  if (failed) {
    return <EmptyState kind="failed" title={failed} onRetry={onRetry} />;
  }
  if (!loading && raffles.length === 0) return null;
  return (
    <section aria-label="Yapılan çekilişler" className="space-y-3">
      <h2 className="text-foreground text-sm font-semibold">Yapılan çekilişler</h2>
      <ListPanel status={listStatus({ loading, rowCount: raffles.length, emptyMessage: '' })}>
        {raffles.map((raffle) => {
          const when = formatRaffleTime(raffle.drawnAt);
          const who = raffle.drawnBy?.name;
          return (
            <ListItem
              key={raffle.id}
              href={raffleHref(eventId, raffle.id)}
              title={raffle.title || 'Çekiliş'}
              subtitle={
                <>
                  <span className="block truncate">
                    {[when, who, raffleCountsLine(raffle)].filter(Boolean).join(' · ')}
                  </span>
                  <span className="text-subtle-foreground block truncate">
                    {raffleCriteriaLine(raffle.criteria, sessions)}
                  </span>
                </>
              }
            />
          );
        })}
      </ListPanel>
    </section>
  );
}
