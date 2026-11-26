'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import {
  isRaffleForbidden,
  RAFFLE_FORBIDDEN,
  raffleEventDates,
  raffleHref,
  raffleProblemMessage,
  rafflesHref,
} from '@/components/raffle/raffle-copy';
import { RaffleForm } from '@/components/raffle/RaffleForm';
import { RaffleHistory } from '@/components/raffle/RaffleHistory';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { rafflesApi, type RaffleSummary } from '@/lib/api/raffles';
import { eventTabHref } from '@/lib/event-workspace';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** Çekiliş: the Event's raffles so far and a new one; for who edits the Event or assigns its Tickets. */
export default function EventRafflesPage() {
  const { event, sessions, days, canMutate, canAssign } = useEventWorkspace();
  const router = useRouter();
  const allowed = canMutate || canAssign;
  const [raffles, setRaffles] = useState<RaffleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  useChromeCrumbName(rafflesHref(event.id), 'Çekiliş');

  const read = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setFailed(null);
    try {
      setRaffles(await rafflesApi.list(event.id));
    } catch (err) {
      if (isRaffleForbidden(err)) setForbidden(true);
      else setFailed(raffleProblemMessage(err, 'Çekilişler okunamadı'));
    } finally {
      setLoading(false);
    }
  }, [allowed, event.id]);

  useEffect(() => {
    void read();
  }, [read]);

  const dates = useMemo(() => raffleEventDates(days, sessions), [days, sessions]);

  if (!allowed || forbidden) {
    return <StateCard title={RAFFLE_FORBIDDEN} tone="danger" />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={eventTabHref(event.id, 'participants')}
          className={`text-skylab-300 hover:text-foreground inline-flex items-center gap-1 ${TEXT_SECONDARY}`}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Katılımcılar
        </Link>
        <h1 className="text-foreground-strong text-lg font-semibold">Çekiliş</h1>
      </div>
      <RaffleHistory
        eventId={event.id}
        raffles={raffles}
        loading={loading}
        failed={failed}
        onRetry={() => void read()}
        sessions={sessions}
      />
      <RaffleForm
        eventId={event.id}
        sessions={sessions}
        dates={dates}
        onDrawn={(raffle) => router.push(raffleHref(event.id, raffle.id))}
      />
    </div>
  );
}
