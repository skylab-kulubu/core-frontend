'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { TicketDetailView } from '@/components/scheduling/TicketDetailView';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi, type Person } from '@/lib/api/identity';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import type { EventSession } from '@/lib/api/sessions';
import { canListEventTickets, ticketApplicantName } from '@/lib/tickets-ui';

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
          throw new ProblemError(403, 'Bu başvuruları görme yetkin yok');
        }
        const [got, users, days] = await Promise.all([
          ticketsApi.get(ticketId).catch(async () => {
            const rows = await ticketsApi.listByEvent(id);
            return rows.find((row) => row.id === ticketId) ?? null;
          }),
          identityApi.listUsers().catch(() => []),
          eventDaysApi.listByEvent(id).catch(() => []),
        ]);
        const sessionRows = (
          await Promise.all(days.map((day) => eventDaysApi.listSessions(day.id).catch(() => [])))
        ).flat();
        if (cancelled) return;
        setEvent(ev);
        setTicket(got);
        setPeople(users);
        setSessions(sessionRows);
        setError(got ? null : 'Başvuru bulunamadı');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ProblemError ? err.title : 'Başvuru yüklenemedi');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, ticketId, user, authLoading]);

  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  if (error && !ticket) return <p className="text-sm text-red-300">{error}</p>;
  if (!event || !ticket) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticketApplicantName(ticket, personById)}
        description={event.name}
        actions={<ActionButton icon={QrCode} label="Kapı" href="/qr" />}
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <TicketDetailView
        ticket={ticket}
        people={personById}
        event={event}
        sessions={sessions.map((session) => ({ id: session.id, title: session.title }))}
      />
    </div>
  );
}
