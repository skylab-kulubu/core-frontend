'use client';

import { useRef, useState } from 'react';
import { MixChart, SectionHeading } from '@/components/chrome/PanelChart';
import { StateCard } from '@/components/chrome/StateCard';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { ApplicantRoster } from '@/components/scheduling/ApplicantRoster';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { coreProblemMessage } from '@/lib/core-problems';
import { ticketsApi } from '@/lib/api/tickets';
import { ALREADY_CHECKED_IN, checkInSuccessLine, doorTicketName } from '@/lib/door-check-in';
import { ticketCheckInMix, ticketMix } from '@/lib/panel-charts';
import { ticketSendProblem } from '@/lib/tickets-ui';
import type { Ticket } from '@/lib/api/tickets';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** Katılımcılar tab: who registered, with check-in, mail and adding a participant. */
export default function EventParticipantsPage() {
  const {
    event,
    tickets,
    sessions,
    personById,
    setError,
    reload,
    mailApplicants,
    canTickets,
    canAssign,
    canDesk,
  } = useEventWorkspace();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  // A second click while the first is out sends nothing more
  const sending = useRef(new Set<string>());

  async function resend(ticket: Ticket) {
    if (sending.current.has(ticket.id)) return;
    sending.current.add(ticket.id);
    try {
      await ticketsApi.resend(ticket.id, crypto.randomUUID());
      notify.success('Bilet yeniden gönderildi');
    } catch (err) {
      setError(ticketSendProblem(err, 'Bilet gönderilemedi'));
    } finally {
      sending.current.delete(ticket.id);
    }
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

  return (
    <div className="space-y-3">
      <SectionHeading title="Başvuranlar" meta={`${tickets.length} kayıt`} />
      {tickets.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <MixChart title="Misafir / üye" data={ticketMix(tickets)} empty="Başvuru yok" />
          <MixChart title="Kapı durumu" data={ticketCheckInMix(tickets)} empty="Kapı kaydı yok" />
        </div>
      ) : null}
      <ApplicantRoster
        eventId={event.id}
        tickets={tickets}
        people={personById}
        event={event}
        sessions={sessions}
        onAddParticipant={canAssign ? () => setAddOpen(true) : undefined}
        onMailSelected={(recipients) =>
          void mailApplicants(recipients.map((recipient) => recipient.ticketId))
        }
        onResend={canAssign ? (ticket) => void resend(ticket) : undefined}
        onRenew={canAssign ? askRenew : undefined}
        onMarkAttended={
          canDesk
            ? async (ticket, sessionId) => {
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
                } catch (err) {
                  setError(coreProblemMessage(err, 'Check-in yapılamadı', ALREADY_CHECKED_IN));
                }
              }
            : undefined
        }
      />
      <AddParticipantDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        eventId={event.id}
        onCreated={async () => {
          await reload();
        }}
      />
      {confirmDialog}
    </div>
  );
}
