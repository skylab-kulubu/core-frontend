'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { ParticipantRoster } from '@/components/scheduling/roster/ParticipantRoster';
import { coreProblemMessage } from '@/lib/core-problems';
import { ticketsApi } from '@/lib/api/tickets';
import { ALREADY_CHECKED_IN, checkInSuccessLine, doorTicketName } from '@/lib/door-check-in';
import { ticketApplicantEmail, ticketSendProblem } from '@/lib/tickets-ui';
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
  } = useEventWorkspace();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // A second click while the first is out sends nothing more
  const sending = useRef(new Set<string>());

  useEffect(() => {
    setOpenId(new URLSearchParams(window.location.search).get(OPEN_PARAM));
  }, []);

  const openTicket = useMemo(
    () => (openId ? (tickets.find((ticket) => ticket.id === openId) ?? null) : null),
    [openId, tickets],
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
      description: 'Eski bağlantı ve QR çalışmaz; yenisi postayla gider.',
      actionLabel: 'Bağlantıyı yenile',
      failure: (err) => ticketSendProblem(err, 'Bağlantı yenilenemedi'),
      onConfirm: async () => {
        await ticketsApi.renewLink(ticket.id, key);
        notify.success('Bağlantı yenilendi, bilet gönderildi');
      },
    });
  }

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
        people={personById}
        event={event}
        sessions={sessions}
        failed={ticketsFailed}
        onRetry={reload}
        openTicket={openTicket}
        onOpenTicket={show}
        onAddParticipant={canAssign ? () => setAddOpen(true) : undefined}
        onMail={(recipients) =>
          void mailApplicants(recipients.map((recipient) => recipient.ticketId))
        }
        onMarkAttended={markAttended}
        onResend={resend}
        onRenew={renew}
        dialogs={confirmDialog}
      />
      <AddParticipantDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        eventId={event.id}
        onCreated={async () => {
          await reload();
        }}
      />
    </>
  );
}
