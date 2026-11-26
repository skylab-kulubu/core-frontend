'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { EmptyState } from '@/components/chrome/PageState';
import { StateCard } from '@/components/chrome/StateCard';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import {
  isRaffleForbidden,
  RAFFLE_FORBIDDEN,
  raffleHref,
  raffleProblemMessage,
  rafflesHref,
} from '@/components/raffle/raffle-copy';
import { RaffleResult } from '@/components/raffle/RaffleResult';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { rafflesApi, type Raffle } from '@/lib/api/raffles';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** One raffle's result: winners, alternates, who did not come, and its proof. */
export default function EventRafflePage({
  params,
}: {
  params: Promise<{ id: string; raffleId: string }>;
}) {
  const { raffleId } = use(params);
  const { event, sessions, canMutate, canAssign } = useEventWorkspace();
  const allowed = canMutate || canAssign;
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  useChromeCrumbName(rafflesHref(event.id), 'Çekiliş');
  useChromeCrumbName(raffleHref(event.id, raffleId), raffle?.title || null);

  const read = useCallback(async () => {
    if (!allowed) return;
    setFailed(null);
    try {
      setRaffle(await rafflesApi.get(event.id, raffleId));
    } catch (err) {
      if (isRaffleForbidden(err)) setForbidden(true);
      else setFailed(raffleProblemMessage(err, 'Çekiliş okunamadı'));
    }
  }, [allowed, event.id, raffleId]);

  useEffect(() => {
    void read();
  }, [read]);

  if (!allowed || forbidden) {
    return <StateCard title={RAFFLE_FORBIDDEN} tone="danger" />;
  }

  return (
    <div className="space-y-4">
      <Link
        href={rafflesHref(event.id)}
        className={`text-skylab-300 hover:text-foreground inline-flex items-center gap-1 ${TEXT_SECONDARY}`}
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Çekilişler
      </Link>
      {failed ? (
        <EmptyState kind="failed" title={failed} onRetry={() => void read()} />
      ) : raffle ? (
        <RaffleResult raffle={raffle} sessions={sessions} onChanged={setRaffle} />
      ) : (
        <PageSkeleton variant="detail" />
      )}
    </div>
  );
}
