'use client';

import { Button, Card, CopyButton } from '@skylab-kulubu/skylcn-ui';
import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { rafflesApi, type Raffle } from '@/lib/api/raffles';
import {
  raffleCheckLine,
  raffleCheckPassed,
  verifyRaffle,
  type RaffleCheck,
} from '@/lib/raffle/verify';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { raffleProblemMessage } from './raffle-copy';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <dt className={`text-muted-foreground ${TEXT_SECONDARY}`}>{label}</dt>
      <dd className="text-foreground min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function Hex({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <code className="min-w-0 font-mono text-[12px]/5 break-all">{value}</code>
      <CopyButton value={value} label={`${label} kopyala`} size="sm" variant="ghost" />
    </span>
  );
}

/**
 * The draw's public proof: the algorithm, the list's hash and the seed, and a check in the
 * browser that the published list and seed give the drawn order (lib/raffle/verify).
 */
export function RaffleVerification({ raffle }: { raffle: Raffle }) {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'running' }
    | { kind: 'done'; check: RaffleCheck }
    | { kind: 'failed'; message: string }
  >({ kind: 'idle' });

  async function run() {
    setState({ kind: 'running' });
    try {
      const verification = await rafflesApi.verification(raffle.eventId, raffle.id);
      const check = await verifyRaffle(verification, raffle.entries);
      setState({ kind: 'done', check });
    } catch (err) {
      setState({
        kind: 'failed',
        message:
          err instanceof Error && !('status' in err)
            ? err.message
            : raffleProblemMessage(err, 'Doğrulama bilgisi okunamadı'),
      });
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-foreground-strong text-sm font-semibold">Doğrulama</h2>
      <dl className="space-y-2">
        <Row label="Algoritma">
          <code className="font-mono text-[12px]/5">{raffle.algorithm}</code>
        </Row>
        <Row label="Uygun kişi">{raffle.eligibleCount}</Row>
        <Row label="Liste özeti">
          <Hex value={raffle.listHash} label="Liste özetini" />
        </Row>
        <Row label="Tohum">
          <Hex value={raffle.seed} label="Tohumu" />
        </Row>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className={BUTTON_TEXT}
          size="sm"
          variant="outline"
          pending={state.kind === 'running'}
          onClick={() => void run()}
        >
          <ShieldCheck aria-hidden />
          Tarayıcıda doğrula
        </Button>
        {state.kind === 'done' ? (
          <p
            role="status"
            className={`${TEXT_SECONDARY} ${raffleCheckPassed(state.check) ? 'text-success' : 'text-destructive'}`}
          >
            {raffleCheckLine(state.check)}
          </p>
        ) : state.kind === 'failed' ? (
          <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
