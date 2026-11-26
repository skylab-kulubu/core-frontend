'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/chrome/PageState';
import { StateCard } from '@/components/chrome/StateCard';
import {
  isRaffleForbidden,
  RAFFLE_FORBIDDEN,
  raffleHref,
  raffleProblemMessage,
} from '@/components/raffle/raffle-copy';
import { RafflePresenter } from '@/components/raffle/RafflePresenter';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { rafflesApi, type Raffle } from '@/lib/api/raffles';

/** A raffle's winners on the projector; read once, so a forfeit shows after a reload. */
export default function EventRafflePresentPage({
  params,
}: {
  params: Promise<{ id: string; raffleId: string }>;
}) {
  const { raffleId } = use(params);
  const { event, canMutate, canAssign } = useEventWorkspace();
  const router = useRouter();
  const allowed = canMutate || canAssign;
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const back = raffleHref(event.id, raffleId);

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

  const exit = useCallback(() => router.push(back), [router, back]);

  if (!allowed || forbidden) {
    return <StateCard title={RAFFLE_FORBIDDEN} tone="danger" />;
  }
  if (failed) {
    return <EmptyState kind="failed" title={failed} onRetry={() => void read()} />;
  }
  if (!raffle) return null;
  return (
    <RafflePresenter
      title={raffle.title || 'Çekiliş'}
      entries={raffle.entries}
      backHref={back}
      onExit={exit}
    />
  );
}
