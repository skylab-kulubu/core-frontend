'use client';

import { useState } from 'react';
import { MixChart, SectionHeading } from '@/components/chrome/PanelChart';
import { StateCard } from '@/components/chrome/StateCard';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { ApplicantRoster } from '@/components/scheduling/ApplicantRoster';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { coreProblemMessage } from '@/lib/core-problems';
import { ticketsApi } from '@/lib/api/tickets';
import { checkInSuccessLine, doorTicketName } from '@/lib/door-check-in';
import { ticketCheckInMix, ticketMix } from '@/lib/panel-charts';
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
  const [addOpen, setAddOpen] = useState(false);

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
                  setError(coreProblemMessage(err, 'Check-in yapılamadı'));
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
    </div>
  );
}
