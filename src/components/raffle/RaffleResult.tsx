'use client';

import { Presentation, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { TextArea } from '@/components/chrome/TextArea';
import {
  FORFEIT_REASON_MAX,
  FORFEIT_REASON_MIN,
  rafflesApi,
  type Raffle,
  type RaffleEntry,
} from '@/lib/api/raffles';
import type { EventSession } from '@/lib/api/sessions';
import { ticketTypeStatus } from '@/lib/status-chip';
import { useConfirm } from '@/lib/ui/use-confirm';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  formatRaffleTime,
  raffleCountsLine,
  raffleCriteriaLine,
  raffleProblemMessage,
  rafflePresentHref,
} from './raffle-copy';
import { RaffleVerification } from './RaffleVerification';

const READY = { kind: 'ready' } as const;

const REASON_SHORT = `Gerekçe en az ${FORFEIT_REASON_MIN} karakter olmalı.`;

class ReasonTooShort extends Error {}

function ReasonField({ onReason }: { onReason: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <label className="block space-y-1">
      <FieldLabel>Gerekçe</FieldLabel>
      <TextArea
        rows={3}
        required
        maxLength={FORFEIT_REASON_MAX}
        placeholder="Salonda değildi"
        value={reason}
        onChange={(change) => {
          setReason(change.target.value);
          onReason(change.target.value);
        }}
      />
    </label>
  );
}

function Rows({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {meta ? <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Place({ n }: { n: number }) {
  return (
    <span className="bg-muted text-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums">
      {n}
    </span>
  );
}

function entryLine(entry: RaffleEntry): string {
  return [entry.maskedEmail, entry.promotedAt ? 'Yedekten geçti' : ''].filter(Boolean).join(' · ');
}

/**
 * A drawn Raffle: its winners (each can be marked as not there, which calls the next
 * alternate), the alternates in order, who did not come, and the draw's proof.
 */
export function RaffleResult({
  raffle,
  sessions,
  onChanged,
}: {
  raffle: Raffle;
  sessions: readonly Pick<EventSession, 'id' | 'title'>[];
  onChanged: (raffle: Raffle) => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const winners = raffle.entries.filter((entry) => entry.status === 'winner');
  const alternates = raffle.entries.filter((entry) => entry.status === 'alternate');
  const forfeited = raffle.entries.filter((entry) => entry.status === 'forfeited');
  const when = formatRaffleTime(raffle.drawnAt);

  function askForfeit(entry: RaffleEntry) {
    const fields = { reason: '' };
    const next = alternates[0];
    confirm({
      title: `${entry.name} gelmedi mi?`,
      description: next ? `Yerine sıradaki yedek ${next.name} kazanan olur.` : 'Yedek kalmadı.',
      content: <ReasonField onReason={(reason) => (fields.reason = reason)} />,
      actionLabel: 'Yedeği çağır',
      destructive: false,
      failure: (err) =>
        err instanceof ReasonTooShort
          ? REASON_SHORT
          : raffleProblemMessage(err, 'Yedek çağrılamadı'),
      onConfirm: async () => {
        const reason = fields.reason.trim();
        if (reason.length < FORFEIT_REASON_MIN) throw new ReasonTooShort();
        const updated = await rafflesApi.forfeit(raffle.eventId, raffle.id, entry.position, reason);
        onChanged(updated);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-foreground-strong text-lg font-semibold">
            {raffle.title || 'Çekiliş'}
          </h1>
          <p className={`text-muted-foreground ${TEXT_SECONDARY}`}>
            {[when, raffle.drawnBy?.name, raffleCountsLine(raffle)].filter(Boolean).join(' · ')}
          </p>
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
            {raffleCriteriaLine(raffle.criteria, sessions)}
          </p>
        </div>
        <ActionButton
          href={rafflePresentHref(raffle.eventId, raffle.id)}
          icon={Presentation}
          label="Projektörde göster"
          variant="primary"
        />
      </div>

      <Rows title="Kazananlar" meta={`${winners.length} kişi`}>
        <ListPanel status={READY}>
          {winners.map((entry, index) => (
            <ListItem
              key={entry.position}
              leading={<Place n={index + 1} />}
              title={entry.name}
              subtitle={entryLine(entry)}
              trailing={
                <span className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex">
                    <StatusChip kind={ticketTypeStatus(entry.ticketType)} />
                  </span>
                  <ActionButton
                    icon={UserX}
                    label="Gelmedi, yedeği çağır"
                    showLabel
                    iconOnlyOnPhone
                    disabled={!alternates.length}
                    title={alternates.length ? undefined : 'Yedek kalmadı'}
                    onClick={() => askForfeit(entry)}
                  />
                </span>
              }
            />
          ))}
        </ListPanel>
      </Rows>

      {alternates.length ? (
        <Rows title="Yedekler" meta="Sırayla çağrılır">
          <ListPanel status={READY}>
            {alternates.map((entry, index) => (
              <ListItem
                key={entry.position}
                leading={<Place n={index + 1} />}
                title={entry.name}
                subtitle={entry.maskedEmail}
                trailing={
                  <span className="hidden sm:inline-flex">
                    <StatusChip kind={ticketTypeStatus(entry.ticketType)} />
                  </span>
                }
              />
            ))}
          </ListPanel>
        </Rows>
      ) : null}

      {forfeited.length ? (
        <Rows title="Gelmeyenler">
          <ListPanel status={READY}>
            {forfeited.map((entry) => (
              <ListItem
                key={entry.position}
                title={entry.name}
                subtitle={[
                  entry.forfeitReason,
                  entry.forfeitedBy?.name,
                  formatRaffleTime(entry.forfeitedAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </ListPanel>
        </Rows>
      ) : null}

      <RaffleVerification raffle={raffle} />
      {confirmDialog}
    </div>
  );
}
