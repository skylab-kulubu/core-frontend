'use client';

import { Button, CopyButton, Timeline, type TimelineItem } from '@skylab-kulubu/skylcn-ui';
import { Ban, CheckCircle2, LogIn, Mail, MailWarning, RotateCcw, TicketCheck } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/chrome/Avatar';
import { StatusChip } from '@/components/chrome/StatusChip';
import { TicketDetailView } from '@/components/scheduling/TicketDetailView';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import type { DoorSession } from '@/lib/door-check-in';
import { formatClock, hasCheckIn } from '@/lib/roster-insights';
import { ticketCheckInStatus, ticketTypeStatus } from '@/lib/status-chip';
import {
  isTicketCancelled,
  ticketApplicantEmail,
  ticketApplicantName,
  ticketSourceForm,
  type TicketSourceEvent,
} from '@/lib/tickets-ui';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';
import { CANCEL_NEEDS_NO_ENTRY, cancelShut, EVENT_OVER } from './ticket-cancel';

/** What happened to a registration, oldest first: registered, ticket mail, entries, cancelled. */
export function ticketTimeline(
  ticket: Ticket,
  sessions: readonly Pick<DoorSession, 'id' | 'title'>[],
  event?: TicketSourceEvent | null,
): TimelineItem[] {
  const titles = new Map(sessions.map((session) => [session.id, session.title]));
  const source = ticketSourceForm(ticket, event);
  const items: TimelineItem[] = [
    {
      id: 'kayit',
      title: 'Kayıt',
      description: source.label !== '—' ? source.label : undefined,
      time: formatClock(ticket.createdAt),
      icon: TicketCheck,
      tone: 'brand',
    },
  ];
  if (ticket.sent === true) {
    items.push({ id: 'mail', title: 'Bilet gönderildi', icon: Mail, tone: 'neutral' });
  } else if (ticket.sent === false) {
    items.push({ id: 'mail', title: 'Bilet gitmedi', icon: MailWarning, tone: 'warning' });
  }
  const entries = [...(ticket.checkIns ?? [])].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  for (const entry of entries) {
    items.push({
      id: entry.id,
      title: `Giriş · ${titles.get(entry.sessionId) ?? entry.sessionId}`,
      time: formatClock(entry.createdAt),
      icon: LogIn,
      tone: 'success',
    });
  }
  if (isTicketCancelled(ticket)) {
    items.push({
      id: 'iptal',
      title: 'Bilet iptal edildi',
      description: ticket.cancelReason || undefined,
      time: ticket.cancelledAt ? formatClock(ticket.cancelledAt) : undefined,
      icon: Ban,
      tone: 'danger',
    });
  }
  return items;
}

/** One registration beside the list: who, what to do, what happened, the form's answers. */
export function TicketPanel({
  ticket,
  people,
  event,
  sessions,
  attendSession,
  showName = false,
  error,
  onMarkAttended,
  onResend,
  onRenew,
  onCancel,
  onRestore,
  eventEnded = false,
}: {
  ticket: Ticket;
  people: Map<string, Person>;
  event?: TicketSourceEvent | null;
  sessions: readonly DoorSession[];
  /** The session "Katıldı" writes to. */
  attendSession?: DoorSession;
  /** The drawer's title names the person; a docked panel says it here. */
  showName?: boolean;
  /** Why the last Katıldı was refused; said under the buttons, where it was pressed. */
  error?: string;
  onMarkAttended?: (ticket: Ticket) => void;
  onResend?: (ticket: Ticket) => void;
  onRenew?: (ticket: Ticket) => void;
  onCancel?: (ticket: Ticket) => void;
  onRestore?: (ticket: Ticket) => void;
  /** The event is over: cancel and Geri al are shown but shut (core `event_ended`). */
  eventEnded?: boolean;
}) {
  const cancelled = isTicketCancelled(ticket);
  const shut = cancelShut(ticket, eventEnded);
  // Said under the buttons when the one offered cannot be pressed
  const shutLine =
    cancelled && onRestore && eventEnded
      ? `${EVENT_OVER}.`
      : !cancelled && onCancel && shut
        ? shut === CANCEL_NEEDS_NO_ENTRY
          ? `İptal için ${CANCEL_NEEDS_NO_ENTRY.toLocaleLowerCase('tr')}.`
          : `${shut}.`
        : null;
  const name = ticketApplicantName(ticket, people);
  const email = ticketApplicantEmail(ticket, people);
  const inSession =
    attendSession && (ticket.checkIns ?? []).some((entry) => entry.sessionId === attendSession.id);
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Avatar name={name} email={email} size="lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          {showName ? (
            <p className="text-foreground-strong truncate text-base font-semibold">{name}</p>
          ) : null}
          {email ? (
            <p className="text-muted-foreground flex items-center gap-1 truncate text-sm">
              <span className="truncate">{email}</span>
              <CopyButton value={email} label="E-postayı kopyala" size="icon-xs" variant="ghost" />
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip kind={ticketTypeStatus(ticket.ticketType)} />
            {cancelled ? (
              <StatusChip kind="cancelled" />
            ) : (
              <StatusChip kind={ticketCheckInStatus(hasCheckIn(ticket))} />
            )}
            {ticket.code ? (
              <span className="text-secondary-foreground inline-flex items-center gap-0.5 font-mono text-xs tabular-nums">
                {ticket.code}
                <CopyButton
                  value={ticket.code}
                  label="Bilet kodunu kopyala"
                  size="icon-xs"
                  variant="ghost"
                />
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {cancelled && onRestore ? (
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            disabled={eventEnded}
            title={eventEnded ? EVENT_OVER : undefined}
            onClick={() => onRestore(ticket)}
          >
            <RotateCcw className="size-4" />
            Geri al
          </Button>
        ) : null}
        {onMarkAttended && !cancelled ? (
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant={inSession ? 'outline' : 'primary'}
            disabled={!attendSession || inSession}
            onClick={() => onMarkAttended(ticket)}
          >
            <CheckCircle2 className="size-4" />
            {inSession ? 'Girişi var' : 'Katıldı'}
          </Button>
        ) : null}
        {onResend && !cancelled ? (
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            onClick={() => onResend(ticket)}
          >
            Bileti yeniden gönder
          </Button>
        ) : null}
        {onRenew && !cancelled ? (
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            onClick={() => onRenew(ticket)}
          >
            Bağlantıyı yenile
          </Button>
        ) : null}
        {onCancel && !cancelled ? (
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            disabled={shut !== null}
            title={shut ?? undefined}
            onClick={() => onCancel(ticket)}
          >
            <Ban className="size-4" />
            Bileti iptal et
          </Button>
        ) : null}
      </div>
      {shutLine ? <p className="text-muted-foreground -mt-4 text-[13px]/5">{shutLine}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive -mt-4 text-sm">
          {error}
        </p>
      ) : null}
      <section aria-label="Geçmiş" className="space-y-2">
        <h3 className="text-foreground text-sm font-semibold">Geçmiş</h3>
        <Timeline items={ticketTimeline(ticket, sessions, event)} />
      </section>
      <TicketDetailView
        ticket={ticket}
        people={people}
        event={event}
        sessions={sessions.map((session) => ({ id: session.id, title: session.title }))}
        groups={['Formdaki diğer cevaplar', 'Kişi', 'Bilet']}
      />
      <Link
        href={`/events/${encodeURIComponent(ticket.eventId)}/tickets/${encodeURIComponent(ticket.id)}`}
        className="text-skylab-300 inline-block text-sm hover:underline"
      >
        Ayrı sayfada aç
      </Link>
    </div>
  );
}
