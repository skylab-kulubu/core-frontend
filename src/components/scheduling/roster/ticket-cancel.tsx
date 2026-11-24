'use client';

import { useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { TextArea } from '@/components/chrome/TextArea';
import type { Person } from '@/lib/api/identity';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { doorTicketName } from '@/lib/door-check-in';
import { ticketCancelProblem } from '@/lib/tickets-ui';
import type { ConfirmRequest } from '@/lib/ui/use-confirm';

/** core keeps at most 500 characters of `cancel_reason` (400 over). */
const REASON_MAX = 500;

/** Why a ticket's cancel is not offered: core refuses a ticket with an entry (`ticket_checked_in`). */
export const CANCEL_NEEDS_NO_ENTRY = 'Önce girişi geri al';

/** Whether the ticket has an entry, so "Bileti iptal et" is shown but not pressable. */
export function cancelBlocked(ticket: Pick<Ticket, 'checkIns'>): boolean {
  return (ticket.checkIns?.length ?? 0) > 0;
}

function ReasonField({ onReason }: { onReason: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <label className="block space-y-1">
      <FieldLabel>Gerekçe (isteğe bağlı)</FieldLabel>
      <TextArea
        rows={3}
        maxLength={REASON_MAX}
        value={reason}
        onChange={(change) => {
          setReason(change.target.value);
          onReason(change.target.value);
        }}
      />
    </label>
  );
}

/**
 * The questions for cancelling a ticket and taking it back (core docs/ticket-cancellation.md),
 * for the list, the drawer and the ticket's own page. `onChanged` gets core's answer.
 */
export function ticketCancelQuestions({
  confirm,
  people,
  onChanged,
  notify,
}: {
  confirm: (request: ConfirmRequest) => void;
  people: Map<string, Person>;
  onChanged: (ticket: Ticket) => void | Promise<void>;
  notify: { success: (title: string) => void };
}) {
  function askCancel(ticket: Ticket) {
    const fields = { reason: '' };
    confirm({
      title: `${doorTicketName(ticket, people)}: bilet iptal edilsin mi?`,
      description: 'Bilet kapıdan geçmez. İptal edilenlerden geri alabilirsin.',
      content: (
        <ReasonField
          onReason={(reason) => {
            fields.reason = reason;
          }}
        />
      ),
      actionLabel: 'Bileti iptal et',
      failure: (err) => ticketCancelProblem(err, 'cancel'),
      onConfirm: async () => {
        const saved = await ticketsApi.cancel(ticket.id, fields.reason.trim() || undefined);
        notify.success('Bilet iptal edildi');
        await onChanged(saved);
      },
    });
  }

  function askRestore(ticket: Ticket) {
    confirm({
      title: `${doorTicketName(ticket, people)}: iptal geri alınsın mı?`,
      description: 'Bilete yeni bağlantı ve QR verilir.',
      actionLabel: 'Geri al',
      destructive: false,
      failure: (err) => ticketCancelProblem(err, 'restore'),
      onConfirm: async () => {
        const saved = await ticketsApi.restore(ticket.id);
        notify.success('Bilet yeniden etkin');
        await onChanged(saved);
      },
    });
  }

  return { askCancel, askRestore };
}
