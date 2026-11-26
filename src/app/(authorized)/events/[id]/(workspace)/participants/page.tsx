'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { AttendeeImportDrawer } from '@/components/scheduling/roster/AttendeeImportDrawer';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { eventEditSectionHref } from '@/lib/event-workspace';
import { ParticipantRoster } from '@/components/scheduling/roster/ParticipantRoster';
import { RespondentList, useRespondents } from '@/components/scheduling/roster/RespondentList';
import { eventHasEnded, ticketCancelQuestions } from '@/components/scheduling/roster/ticket-cancel';
import { coreProblemMessage } from '@/lib/core-problems';
import { ticketsApi } from '@/lib/api/tickets';
import { ALREADY_CHECKED_IN, checkInSuccessLine, doorTicketName } from '@/lib/door-check-in';
import { isTicketCancelled, ticketApplicantEmail, ticketSendProblem } from '@/lib/tickets-ui';
import type { Ticket } from '@/lib/api/tickets';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** The registration open beside the list is in the address, so a link reopens it. */
const OPEN_PARAM = 'kayit';

function setOpenParam(ticketId: string | null) {
  const url = new URL(window.location.href);
  if (ticketId) url.searchParams.set(OPEN_PARAM, ticketId);
  else url.searchParams.delete(OPEN_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Katılımcılar tab: who registered, with check-in, mail and adding a participant. */
export default function EventParticipantsPage() {
  const {
    event,
    tickets,
    ticketsFailed,
    sessions,
    personById,
    reload,
    mailApplicants,
    canTickets,
    canAssign,
    canDesk,
    canCancelTickets,
    canMutate,
  } = useEventWorkspace();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // A second click while the first is out sends nothing more
  const sending = useRef(new Set<string>());

  // The cancelled tickets core lists apart; none shown when they cannot be read
  const [cancelled, setCancelled] = useState<Ticket[] | undefined>(undefined);
  const readCancelled = useCallback(async () => {
    if (!canTickets) return;
    try {
      const rows = await ticketsApi.listByEvent(event.id, 'cancelled');
      // A core without ticket status answers every ticket to the unknown `?status=`
      setCancelled(rows.filter(isTicketCancelled));
    } catch {
      setCancelled(undefined);
    }
  }, [canTickets, event.id]);
  useEffect(() => {
    void readCancelled();
  }, [readCancelled]);

  // The waiting list, read the same way; a core without it lists nothing waiting
  const [waitlisted, setWaitlisted] = useState<Ticket[] | undefined>(undefined);
  const readWaitlisted = useCallback(async () => {
    if (!canTickets) return;
    try {
      const rows = await ticketsApi.listByEvent(event.id, 'waitlisted');
      setWaitlisted(rows.filter((ticket) => ticket.status === 'waitlisted'));
    } catch {
      setWaitlisted(undefined);
    }
  }, [canTickets, event.id]);
  useEffect(() => {
    void readWaitlisted();
  }, [readWaitlisted]);

  // Form answers with no Ticket yet: read by who may see the Tickets (core docs/form-respondents.md)
  const respondents = useRespondents(event.id, canTickets);

  // The address decides, also when a link changes it while the page is open
  const linked = useSearchParams()?.get(OPEN_PARAM) ?? null;
  useEffect(() => {
    setOpenId(linked);
  }, [linked]);

  const openTicket = useMemo(
    () =>
      openId
        ? (tickets.find((ticket) => ticket.id === openId) ??
          cancelled?.find((ticket) => ticket.id === openId) ??
          waitlisted?.find((ticket) => ticket.id === openId) ??
          null)
        : null,
    [openId, tickets, cancelled, waitlisted],
  );

  function show(ticket: Ticket | null) {
    setOpenId(ticket?.id ?? null);
    setOpenParam(ticket?.id ?? null);
  }

  function askResend(ticket: Ticket) {
    // One key per question: a retry in the dialog sends once
    const key = crypto.randomUUID();
    const email = ticketApplicantEmail(ticket, personById);
    confirm({
      title: `${doorTicketName(ticket, personById)}: bilet yeniden gönderilsin mi?`,
      description: email ? `Bilet ${email} adresine gider.` : undefined,
      actionLabel: 'Bileti gönder',
      destructive: false,
      failure: (err) => ticketSendProblem(err, 'Bilet gönderilemedi'),
      onConfirm: async () => {
        if (sending.current.has(ticket.id)) return;
        sending.current.add(ticket.id);
        try {
          await ticketsApi.resend(ticket.id, key);
          notify.success('Bilet yeniden gönderildi');
        } finally {
          sending.current.delete(ticket.id);
        }
      },
    });
  }

  function askRenew(ticket: Ticket) {
    // One key per question: a retry in the dialog renews once
    const key = crypto.randomUUID();
    confirm({
      title: `${doorTicketName(ticket, personById)}: bağlantı yenilensin mi?`,
      description: 'Eski bağlantı ve QR çalışmaz; yenisi e-postayla gider.',
      actionLabel: 'Bağlantıyı yenile',
      failure: (err) => ticketSendProblem(err, 'Bağlantı yenilenemedi'),
      onConfirm: async () => {
        await ticketsApi.renewLink(ticket.id, key);
        notify.success('Bağlantı yenilendi, bilet gönderildi');
      },
    });
  }

  const capacity = event.capacity ?? 0;
  const readAll = async () => {
    await Promise.all([reload(), readCancelled(), readWaitlisted(), respondents.reload()]);
  };

  // Exactly who may edit the event cancels a ticket and takes it back (core)
  const { askCancel, askRestore, askPromote, askLeave } = ticketCancelQuestions({
    confirm,
    people: personById,
    notify,
    // Geri al and Öne al may go past the capacity (core `overCapacity`)
    seats: { active: tickets.length, capacity },
    onChanged: async () => {
      await readAll();
    },
  });

  if (!canTickets) {
    return <StateCard title="Katılımcıları görme yetkin yok" tone="danger" />;
  }

  const resend = canAssign ? askResend : undefined;
  const renew = canAssign ? askRenew : undefined;
  const markAttended = canDesk
    ? async (ticket: Ticket, sessionId: string) => {
        try {
          const created = await ticketsApi.checkIn(ticket.id, sessionId);
          const sessionTitle =
            sessions.find((session) => session.id === sessionId)?.title || sessionId;
          // A toast: the result line above the roster is off screen on a phone
          notify.success(
            checkInSuccessLine({
              name: doorTicketName(ticket, personById),
              sessionTitle,
              createdAt: created.createdAt,
            }),
          );
          await reload();
          return null;
        } catch (err) {
          return coreProblemMessage(err, 'Giriş yazılamadı', ALREADY_CHECKED_IN);
        }
      }
    : undefined;

  return (
    <>
      <ParticipantRoster
        eventId={event.id}
        tickets={tickets}
        cancelledTickets={cancelled}
        waitlistedTickets={waitlisted}
        capacity={capacity}
        people={personById}
        event={event}
        sessions={sessions}
        failed={ticketsFailed}
        onRetry={reload}
        openTicket={openTicket}
        onOpenTicket={show}
        onAddParticipant={canAssign ? () => setAddOpen(true) : undefined}
        onImport={canAssign ? () => setImportOpen(true) : undefined}
        settingsHref={canMutate ? eventEditSectionHref(event.id, 'basvuru') : undefined}
        onMail={(recipients) =>
          void mailApplicants(recipients.map((recipient) => recipient.ticketId))
        }
        onMarkAttended={markAttended}
        onResend={resend}
        onRenew={renew}
        onCancel={
          canCancelTickets
            ? (ticket) => (ticket.status === 'waitlisted' ? askLeave(ticket) : askCancel(ticket))
            : undefined
        }
        onRestore={canCancelTickets ? askRestore : undefined}
        onPromote={canCancelTickets ? askPromote : undefined}
        eventEnded={eventHasEnded(event)}
        dialogs={confirmDialog}
        respondentCounts={
          respondents.available
            ? {
                unticketed: respondents.accepted.total,
                formsPending: respondents.pending.total,
                failed: respondents.failed,
              }
            : undefined
        }
        renderRespondents={(view, query) => (
          <RespondentList
            eventId={event.id}
            view={view}
            query={query}
            respondents={respondents}
            confirm={confirm}
            // core: Update on the Event or Assign on its Tickets, as the attendee import
            canSend={canMutate || canAssign}
            onSent={async (line) => {
              notify.success(line);
              await readAll();
            }}
            onRefresh={readAll}
          />
        )}
      />
      <AddParticipantDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        eventId={event.id}
        capacity={capacity}
        activeTickets={tickets.length}
        onCreated={async () => {
          await readAll();
        }}
      />
      <AttendeeImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        eventId={event.id}
        capacity={capacity}
        onImported={async () => {
          await readAll();
        }}
      />
    </>
  );
}
