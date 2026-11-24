'use client';

import { useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { TextArea } from '@/components/chrome/TextArea';
import { CheckboxRow } from '@/components/scheduling/use-event-status-actions';
import { capacityFull, overCapacityLine } from '@/lib/capacity';
import type { Person } from '@/lib/api/identity';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { doorTicketName } from '@/lib/door-check-in';
import { eventEndsAt } from '@/lib/events-view';
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

/** Why cancel and Geri al are shut once the event is over: core refuses both (`event_ended`). */
export const EVENT_OVER = 'Etkinlik bitti';

/** Whether the event is over as core counts it (`Event.EndedAt`: its end, or a day after an undated start). */
export function eventHasEnded(
  event: { startDate?: string; endDate?: string } | null | undefined,
  now = new Date(),
): boolean {
  const end = event ? eventEndsAt(event) : null;
  return end !== null && end <= now.getTime();
}

/** Why "Bileti iptal et" cannot be pressed for this ticket, or null when it can. */
export function cancelShut(ticket: Pick<Ticket, 'checkIns'>, eventEnded: boolean): string | null {
  if (eventEnded) return EVENT_OVER;
  return cancelBlocked(ticket) ? CANCEL_NEEDS_NO_ENTRY : null;
}

/** What an operator's cancel sends: an optional reason, and whether the holder is told. */
type CancelFields = { reason: string; notify: boolean };

/** The holder is told by default (core #412 `notify`; core before it ignores the field). */
export const NOTIFY_LABEL = 'Kişiye bildir';

function NotifyBox({ fields }: { fields: CancelFields }) {
  return (
    <CheckboxRow
      label={NOTIFY_LABEL}
      defaultChecked={fields.notify}
      onChange={(notify) => {
        fields.notify = notify;
      }}
    />
  );
}

function ReasonField({ fields }: { fields: CancelFields }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <FieldLabel>Gerekçe (isteğe bağlı)</FieldLabel>
        <TextArea
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(change) => {
            setReason(change.target.value);
            fields.reason = change.target.value;
          }}
        />
      </label>
      <NotifyBox fields={fields} />
    </div>
  );
}

/**
 * The questions for cancelling a ticket, taking it back, and the waiting list's Öne al and
 * Listeden çıkar (core docs/ticket-cancellation.md, docs/event-capacity.md), for the list, the
 * drawer and the ticket's own page. `onChanged` gets core's answer.
 */
export function ticketCancelQuestions({
  confirm,
  people,
  onChanged,
  notify,
  seats = { active: 0, capacity: 0 },
}: {
  confirm: (request: ConfirmRequest) => void;
  people: Map<string, Person>;
  onChanged: (ticket: Ticket) => void | Promise<void>;
  notify: { success: (title: string, description?: string) => void };
  /** The Event's active tickets and capacity (0: none), to say when a write goes past it. */
  seats?: { active: number; capacity: number };
}) {
  const { active, capacity } = seats;
  /** The toast, with the capacity gone past when core says so (`overCapacity`). */
  function written(title: string, saved: Ticket) {
    if (saved.overCapacity) notify.success(title, overCapacityLine(active + 1, capacity));
    else notify.success(title);
  }

  function askCancel(ticket: Ticket) {
    const fields: CancelFields = { reason: '', notify: true };
    confirm({
      title: `${doorTicketName(ticket, people)}: bilet iptal edilsin mi?`,
      description: 'Bilet kapıdan geçmez. İptal edilenlerden geri alabilirsin.',
      content: <ReasonField fields={fields} />,
      actionLabel: 'Bileti iptal et',
      failure: (err) => ticketCancelProblem(err, 'cancel'),
      onConfirm: async () => {
        const saved = await ticketsApi.cancel(ticket.id, {
          reason: fields.reason.trim() || undefined,
          notify: fields.notify,
        });
        notify.success('Bilet iptal edildi');
        await onChanged(saved);
      },
    });
  }

  function askRestore(ticket: Ticket) {
    confirm({
      title: `${doorTicketName(ticket, people)}: iptal geri alınsın mı?`,
      description: 'Kişiye yeni bağlantı ve QR’lı bilet postası gider.',
      actionLabel: 'Geri al',
      destructive: false,
      failure: (err) => ticketCancelProblem(err, 'restore'),
      onConfirm: async () => {
        const saved = await ticketsApi.restore(ticket.id);
        written('Bilet yeniden etkin', saved);
        await onChanged(saved);
      },
    });
  }

  /** "Öne al": active past the capacity if it must (core `overCapacity`), said beforehand. */
  function askPromote(ticket: Ticket) {
    const full = capacityFull(active, capacity);
    confirm({
      title: `${doorTicketName(ticket, people)} öne alınsın mı?`,
      description: full
        ? `Bilet etkinleşir ve kontenjan aşılır (${active + 1}/${capacity}).`
        : 'Bilet etkinleşir, kişiye bilet postası gider.',
      actionLabel: 'Öne al',
      destructive: false,
      failure: (err) => ticketCancelProblem(err, 'promote'),
      onConfirm: async () => {
        const saved = await ticketsApi.promote(ticket.id);
        written('Öne alındı', saved);
        await onChanged(saved);
      },
    });
  }

  /** "Listeden çıkar": the operator's cancel of a waitlisted ticket; it frees no place. */
  function askLeave(ticket: Ticket) {
    const fields: CancelFields = { reason: '', notify: true };
    confirm({
      title: `${doorTicketName(ticket, people)} listeden çıkarılsın mı?`,
      description: 'İptal edilenlere geçer.',
      content: <NotifyBox fields={fields} />,
      actionLabel: 'Listeden çıkar',
      failure: (err) => ticketCancelProblem(err, 'cancel'),
      onConfirm: async () => {
        const saved = await ticketsApi.cancel(ticket.id, { notify: fields.notify });
        notify.success('Listeden çıkarıldı');
        await onChanged(saved);
      },
    });
  }

  return { askCancel, askRestore, askPromote, askLeave };
}
