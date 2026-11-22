'use client';

import { Button, Section } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { MixChart, SectionHeading } from '@/components/chrome/PanelChart';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { ApplicantRoster } from '@/components/scheduling/ApplicantRoster';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { TicketDetailView } from '@/components/scheduling/TicketDetailView';
import { coreProblemMessage } from '@/lib/core-problems';
import { ticketsApi } from '@/lib/api/tickets';
import { ALREADY_CHECKED_IN, checkInSuccessLine, doorTicketName } from '@/lib/door-check-in';
import { ticketCheckInMix, ticketMix } from '@/lib/panel-charts';
import { ticketCheckInStatus, ticketTypeStatus } from '@/lib/status-chip';
import { ticketApplicantEmail, ticketSendProblem, ticketStatus } from '@/lib/tickets-ui';
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

/** The charts start folded on phones, where the list comes first. */
function useWideScreen(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    setWide(window.matchMedia('(min-width: 1024px)').matches);
  }, []);
  return wide;
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
  const wide = useWideScreen();
  const [chartsOpen, setChartsOpen] = useState<boolean | null>(null);
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
  const openStatus = openTicket ? ticketStatus(openTicket) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeading title="Başvuranlar" meta={`${tickets.length} kayıt`} />
        <ApplicantRoster
          eventId={event.id}
          tickets={tickets}
          people={personById}
          event={event}
          sessions={sessions}
          failed={ticketsFailed}
          onRetry={reload}
          onOpenTicket={show}
          onAddParticipant={canAssign ? () => setAddOpen(true) : undefined}
          onMailSelected={(recipients) =>
            void mailApplicants(recipients.map((recipient) => recipient.ticketId))
          }
          onResend={resend}
          onRenew={renew}
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
                    return null;
                  } catch (err) {
                    return coreProblemMessage(err, 'Giriş yazılamadı', ALREADY_CHECKED_IN);
                  }
                }
              : undefined
          }
        />
      </div>
      {tickets.length > 0 ? (
        <Section
          title="Dağılım"
          level={2}
          // skylcn-ui's folding title loses its last letters to the button's -mx-1 (truncate on the h2)
          className="[&_h2]:overflow-visible"
          collapsible
          open={chartsOpen ?? wide}
          onOpenChange={setChartsOpen}
        >
          <div className="grid gap-6 pt-3 lg:grid-cols-2">
            <MixChart title="Misafir / üye" data={ticketMix(tickets)} empty="Başvuru yok" />
            <MixChart title="Kapı durumu" data={ticketCheckInMix(tickets)} empty="Kapı kaydı yok" />
          </div>
        </Section>
      ) : null}
      <AddParticipantDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        eventId={event.id}
        onCreated={async () => {
          await reload();
        }}
      />
      <Drawer
        open={openTicket !== null}
        onClose={() => show(null)}
        title={openTicket ? doorTicketName(openTicket, personById) : 'Kayıt'}
      >
        {openTicket && openStatus ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip kind={ticketTypeStatus(openTicket.ticketType)} />
              <StatusChip kind={ticketCheckInStatus(openStatus.key === 'checked-in')} />
              {openTicket.code ? (
                <span className="text-secondary-foreground font-mono text-sm tabular-nums">
                  {openTicket.code}
                </span>
              ) : null}
            </div>
            {resend || renew ? (
              <div className="flex flex-wrap gap-2">
                {resend ? (
                  <Button size="sm" variant="outline" onClick={() => resend(openTicket)}>
                    Bileti yeniden gönder
                  </Button>
                ) : null}
                {renew ? (
                  <Button size="sm" variant="outline" onClick={() => renew(openTicket)}>
                    Bağlantıyı yenile
                  </Button>
                ) : null}
              </div>
            ) : null}
            <TicketDetailView
              ticket={openTicket}
              people={personById}
              event={event}
              sessions={sessions.map((session) => ({ id: session.id, title: session.title }))}
            />
            <Link
              href={`/events/${encodeURIComponent(event.id)}/tickets/${encodeURIComponent(openTicket.id)}`}
              className="text-skylab-300 inline-block text-sm hover:underline"
            >
              Ayrı sayfada aç
            </Link>
          </div>
        ) : null}
        {openTicket ? confirmDialog : null}
      </Drawer>
      {openTicket ? null : confirmDialog}
    </div>
  );
}
