'use client';

import { useEffect, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { Select } from '@/components/chrome/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { type EventSession } from '@/lib/api/sessions';
import { ticketsApi, type CheckIn } from '@/lib/api/tickets';
import { canCheckInForTeam } from '@/lib/auth/groups';
import { saveClass } from '@/lib/scheduling/save-event';
import { useAuth } from '@/context/AuthContext';

export default function QrPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [eventId, setEventId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckIn | null>(null);

  useEffect(() => {
    eventsApi
      .list()
      .then((rows) => {
        const allowed = rows.filter((ev) => canCheckInForTeam(groups, ev.ownerTeam));
        setEvents(allowed);
        setEventId(allowed[0]?.id ?? '');
      })
      .catch((err) =>
        setError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi'),
      );
  }, [user]);

  useEffect(() => {
    if (!eventId) {
      setSessions([]);
      setSessionId('');
      return;
    }
    eventDaysApi
      .listByEvent(eventId)
      .then(async (days) => {
        const nested = await Promise.all(days.map((day) => eventDaysApi.listSessions(day.id)));
        const rows = nested.flat();
        setSessions(rows);
        setSessionId(rows[0]?.id ?? '');
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Oturumlar yüklenemedi'));
  }, [eventId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR / check-in"
        description="Bilet id ve oturum ile kapı kaydı. Java QR üretici yok."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <form
        className="max-w-md space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const created = await ticketsApi.checkIn(ticketId.trim(), sessionId);
            setResult(created);
            setError(null);
          } catch (err) {
            setResult(null);
            setError(err instanceof ProblemError ? err.title : 'Check-in yapılamadı');
          }
        }}
      >
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} required>
          <option value="">Etkinlik</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </Select>
        <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)} required>
          <option value="">Oturum</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title}
            </option>
          ))}
        </Select>
        <Field
          placeholder="Bilet id"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          required
        />
        <button type="submit" className={saveClass}>
          Check-in
        </button>
      </form>
      {result ? (
        <p className="text-sm text-neutral-300">
          Kayıt: {result.id} · {new Date(result.createdAt).toLocaleString('tr-TR')}
        </p>
      ) : null}
    </div>
  );
}
