'use client';

import { Button, MenuItem, Timeline, type DescriptionItem } from '@skylab-kulubu/skylcn-ui';
import { CheckCircle2, KeyRound, Mail, Undo2, UserRound } from 'lucide-react';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Command, CommandBar, CommandMenu } from '@/components/chrome/object-page/CommandBar';
import {
  ObjectCard,
  ObjectEssentials,
  ObjectPage,
  ObjectPageHeader,
} from '@/components/chrome/object-page/ObjectPage';
import { EmptyState } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { ticketTimeline } from '@/components/scheduling/roster/TicketPanel';
import { TicketDetailView } from '@/components/scheduling/TicketDetailView';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import type { Person } from '@/lib/api/identity';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import type { EventSession } from '@/lib/api/sessions';
import {
  ALREADY_CHECKED_IN,
  checkInSuccessLine,
  defaultDoorSessionId,
  doorTicketName,
} from '@/lib/door-check-in';
import { eventStatusOf } from '@/lib/events-view';
import { lookupPeople } from '@/lib/people-lookup';
import { formatClock, hasCheckIn } from '@/lib/roster-insights';
import { teamDecision } from '@/lib/use-app-can';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useDeferredUndo } from '@/lib/ui/use-deferred-undo';
import { useNotify } from '@/lib/ui/use-notify';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  canAssignEventTicket,
  canDeskCheckIn,
  canListEventTickets,
  ticketApplicantEmail,
  ticketApplicantName,
  ticketCrumbName,
  ticketOwnerPeople,
  ticketSendProblem,
  ticketSourceForm,
  ticketTypeLabel,
} from '@/lib/tickets-ui';
import { ticketCheckInStatus, ticketTypeStatus } from '@/lib/status-chip';

/**
 * One registration as an object page (Entra's user overview): who, with Katıldı, the ticket
 * mail and a new link as commands; the key facts, what happened (entries can be taken back)
 * and the form's answers. The same content the participants list opens beside itself.
 */
export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string; ticketId: string }>;
}) {
  const { id, ticketId } = use(params);
  const { user, loading: authLoading } = useAuth();
  // core's ticket.read for the event's Owner team (a Sub-team led from above included)
  const capabilities = useCapabilities();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const deferred = useDeferredUndo();
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading || capabilities.status === 'loading') return;
    let cancelled = false;
    async function load() {
      try {
        const ev = await eventsApi.get(id);
        const groupRule = canListEventTickets(user?.groups ?? [], ev.ownerTeam);
        if (!teamDecision(capabilities, ev.ownerTeam, 'ticket.read', groupRule)) {
          throw new ProblemError(403, 'Forbidden', { detail: 'Bu başvuruları görme yetkin yok' });
        }
        const [got, days] = await Promise.all([
          ticketsApi.get(ticketId).catch(async () => {
            const rows = await ticketsApi.listByEvent(id);
            return rows.find((row) => row.id === ticketId) ?? null;
          }),
          eventDaysApi.listByEvent(id).catch(() => []),
        ]);
        // The ticket carries its owner; GET /v1/users/{id} only if it does not.
        const [owners, sessionRows] = await Promise.all([
          lookupPeople(got?.ownerId ? [got.ownerId] : [], ticketOwnerPeople(got ? [got] : [])),
          Promise.all(days.map((day) => eventDaysApi.listSessions(day.id).catch(() => []))),
        ]);
        if (cancelled) return;
        setEvent(ev);
        setTicket(got);
        setPeople([...owners.values()]);
        setSessions(sessionRows.flat());
        setError(got ? null : 'Başvuru bulunamadı');
      } catch (err) {
        if (cancelled) return;
        setError(coreProblemMessage(err, 'Başvuru yüklenemedi'));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, ticketId, user, authLoading, capabilities]);

  const reloadTicket = useCallback(async () => {
    try {
      setTicket(await ticketsApi.get(ticketId));
    } catch {
      // The page keeps what it showed; the next visit reads it again
    }
  }, [ticketId]);

  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  useChromeCrumbName(`/events/${id}`, event?.name);
  useChromeCrumbName(
    `/events/${id}/tickets/${ticketId}`,
    ticket ? ticketCrumbName(ticket, personById) : null,
  );

  if (error && !ticket) {
    return <EmptyState kind="failed" title={error} onRetry={() => window.location.reload()} />;
  }
  if (!event || !ticket) return <PageSkeleton variant="detail" />;

  const groups = user?.groups ?? [];
  const open = eventStatusOf(event) !== 'cancelled';
  const canAssign =
    open &&
    teamDecision(
      capabilities,
      event.ownerTeam,
      'ticket.assign',
      canAssignEventTicket(groups, event.ownerTeam),
    );
  const canDesk =
    open &&
    teamDecision(
      capabilities,
      event.ownerTeam,
      'door.checkIn',
      canDeskCheckIn(groups, event.ownerTeam),
    );
  const canReadPeople =
    capabilities.status === 'ready' && Boolean(capabilities.data.can?.['user.read']);
  const name = ticketApplicantName(ticket, personById);
  const email = ticketApplicantEmail(ticket, personById);
  const titles = new Map(sessions.map((session) => [session.id, session.title]));
  const entered = new Set((ticket.checkIns ?? []).map((entry) => entry.sessionId));
  const attendSession = sessions.find((session) => session.id === defaultDoorSessionId(sessions));

  async function attend(sessionId: string) {
    if (!ticket || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const created = await ticketsApi.checkIn(ticket.id, sessionId);
      notify.success(
        checkInSuccessLine({
          name: doorTicketName(ticket, personById),
          sessionTitle: titles.get(sessionId) ?? sessionId,
          createdAt: created.createdAt,
        }),
      );
      await reloadTicket();
    } catch (err) {
      setActionError(coreProblemMessage(err, 'Giriş yazılamadı', ALREADY_CHECKED_IN));
    } finally {
      setBusy(false);
    }
  }

  // Like the door desk: the entry goes after a few seconds with Vazgeç, not at the first press
  function undo(sessionId: string, checkInId: string) {
    if (!ticket) return;
    setActionError(null);
    deferred.schedule(
      checkInId,
      `${titles.get(sessionId) ?? 'Oturum'}: giriş geri alınıyor`,
      async () => {
        try {
          await ticketsApi.undoCheckIn(sessionId, checkInId);
          notify.success('Giriş geri alındı');
          await reloadTicket();
        } catch (err) {
          setActionError(coreProblemMessage(err, 'Geri alınamadı'));
        }
      },
    );
  }

  function askResend() {
    if (!ticket) return;
    // One key per question: a retry in the dialog sends once
    const key = crypto.randomUUID();
    const target = ticket;
    confirm({
      title: `${doorTicketName(target, personById)}: bilet yeniden gönderilsin mi?`,
      description: email ? `Bilet ${email} adresine gider.` : undefined,
      actionLabel: 'Bileti gönder',
      destructive: false,
      failure: (err) => ticketSendProblem(err, 'Bilet gönderilemedi'),
      onConfirm: async () => {
        await ticketsApi.resend(target.id, key);
        notify.success('Bilet yeniden gönderildi');
      },
    });
  }

  function askRenew() {
    if (!ticket) return;
    const key = crypto.randomUUID();
    const target = ticket;
    confirm({
      title: `${doorTicketName(target, personById)}: bağlantı yenilensin mi?`,
      description: 'Eski bağlantı ve QR çalışmaz; yenisi e-postayla gider.',
      actionLabel: 'Bağlantıyı yenile',
      failure: (err) => ticketSendProblem(err, 'Bağlantı yenilenemedi'),
      onConfirm: async () => {
        await ticketsApi.renewLink(target.id, key);
        notify.success('Bağlantı yenilendi, bilet gönderildi');
        await reloadTicket();
      },
    });
  }

  const source = ticketSourceForm(ticket, event);
  const essentials: DescriptionItem[] = [
    { label: 'Etkinlik', value: event.name },
    { label: 'Tür', value: ticketTypeLabel(ticket.ticketType) },
    { label: 'Bilet kodu', value: ticket.code ?? '—' },
    { label: 'Kaynak', value: source.label },
    { label: 'Kayıt', value: formatClock(ticket.createdAt) },
    {
      label: 'Bilet e-postası',
      value: ticket.sent === true ? 'Gönderildi' : ticket.sent === false ? 'Gitmedi' : '—',
    },
  ];
  if (email) essentials.splice(1, 0, { label: 'E-posta', value: email });

  const unentered = sessions.filter((session) => !session.cancelled && !entered.has(session.id));
  const attendCommand =
    !canDesk || !sessions.length ? null : attendSession && !entered.has(attendSession.id) ? (
      <Command
        primary
        icon={CheckCircle2}
        label="Katıldı"
        title={attendSession.title}
        disabled={busy}
        onClick={() => void attend(attendSession.id)}
      />
    ) : unentered.length ? (
      <CommandMenu
        label="Katıldı"
        name="Katıldı: oturum seç"
        items={unentered.map((session) => (
          <MenuItem key={session.id} onClick={() => void attend(session.id)}>
            {session.title}
          </MenuItem>
        ))}
      />
    ) : null;

  const entries = [...(ticket.checkIns ?? [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  return (
    <>
      <ObjectPage
        header={
          <ObjectPageHeader
            eyebrow={`Kayıt · ${event.name}`}
            title={name}
            badges={
              <>
                <StatusChip kind={ticketTypeStatus(ticket.ticketType)} />
                <StatusChip kind={ticketCheckInStatus(hasCheckIn(ticket))} />
              </>
            }
          />
        }
        commands={
          <CommandBar label="Kayıt komutları">
            {attendCommand}
            {canAssign ? (
              <Command icon={Mail} label="Bileti yeniden gönder" onClick={askResend} />
            ) : null}
            {canAssign ? (
              <Command icon={KeyRound} label="Bağlantıyı yenile" onClick={askRenew} />
            ) : null}
            {ticket.ownerId && canReadPeople ? (
              <Command
                icon={UserRound}
                label="Kişi kartı"
                href={`/users/${encodeURIComponent(ticket.ownerId)}`}
              />
            ) : null}
          </CommandBar>
        }
        notices={
          actionError ? (
            <p role="alert" className="text-destructive text-sm">
              {actionError}
            </p>
          ) : null
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <ObjectEssentials items={essentials} title="Temel bilgiler" />
            <ObjectCard title="Formdaki cevaplar">
              <TicketDetailView
                ticket={ticket}
                people={personById}
                event={event}
                sessions={sessions.map((session) => ({ id: session.id, title: session.title }))}
                groups={['Formdaki diğer cevaplar']}
                headings={false}
              />
            </ObjectCard>
            <ObjectCard title="Kişi">
              <TicketDetailView
                ticket={ticket}
                people={personById}
                event={event}
                groups={['Kişi']}
                headings={false}
              />
            </ObjectCard>
          </div>
          <div className="space-y-4">
            <ObjectCard title="Girişler">
              {entries.length ? (
                <ul className="divide-border-subtle divide-y">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex min-h-11 items-center gap-3 py-1.5">
                      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-sm">
                          {titles.get(entry.sessionId) ?? 'Oturum'}
                        </span>
                        <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                          {formatClock(entry.createdAt)}
                        </span>
                      </span>
                      {canDesk && deferred.pending.has(entry.id) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${titles.get(entry.sessionId) ?? 'Oturum'}: geri almaktan vazgeç`}
                          onClick={() => deferred.cancel(entry.id)}
                        >
                          Vazgeç
                        </Button>
                      ) : canDesk ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          aria-label={`${titles.get(entry.sessionId) ?? 'Oturum'}: girişi geri al`}
                          onClick={() => undo(entry.sessionId, entry.id)}
                        >
                          <Undo2 aria-hidden />
                          Geri al
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Giriş yok</p>
              )}
            </ObjectCard>
            <ObjectCard title="Geçmiş">
              <Timeline items={ticketTimeline(ticket, sessions, event)} />
            </ObjectCard>
          </div>
        </div>
      </ObjectPage>
      {confirmDialog}
    </>
  );
}
