'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { TicketDetailView } from '@/components/scheduling/TicketDetailView';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import type { Person } from '@/lib/api/identity';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import type { EventSession } from '@/lib/api/sessions';
import { lookupPeople } from '@/lib/people-lookup';
import {
  canListEventTickets,
  ticketApplicantName,
  ticketOwnerPeople,
  ticketStatus,
} from '@/lib/tickets-ui';
import { ticketCheckInStatus, ticketTypeStatus } from '@/lib/status-chip';

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string; ticketId: string }>;
}) {
  const { id, ticketId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    async function load() {
      try {
        const ev = await eventsApi.get(id);
        if (!canListEventTickets(user?.groups ?? [], ev.ownerTeam)) {
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
        const owners = await lookupPeople(
          got?.ownerId ? [got.ownerId] : [],
          ticketOwnerPeople(got ? [got] : []),
        );
        const sessionRows = (
          await Promise.all(days.map((day) => eventDaysApi.listSessions(day.id).catch(() => [])))
        ).flat();
        if (cancelled) return;
        setEvent(ev);
        setTicket(got);
        setPeople([...owners.values()]);
        setSessions(sessionRows);
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
  }, [id, ticketId, user, authLoading]);

  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  if (error && !ticket) {
    return <StateCard title={error} description="Başvuru kaydına dönemiyor." tone="danger" />;
  }
  if (!event || !ticket) return <StateCard title="Yükleniyor…" isLoading />;

  const status = ticketStatus(ticket);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticketApplicantName(ticket, personById)}
        description={event.name}
        meta={
          <>
            <StatusChip kind={ticketTypeStatus(ticket.ticketType)} />
            <StatusChip kind={ticketCheckInStatus(status.key === 'checked-in')} />
          </>
        }
        actions={
          <ActionButton icon={QrCode} label="Kapı" href={`/qr?eventId=${encodeURIComponent(id)}`} />
        }
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <TicketDetailView
        ticket={ticket}
        people={personById}
        event={event}
        sessions={sessions.map((session) => ({ id: session.id, title: session.title }))}
      />
    </div>
  );
}
