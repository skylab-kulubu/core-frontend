'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Inbox } from 'lucide-react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { type EventSession } from '@/lib/api/sessions';
import { ticketsApi, type CheckIn } from '@/lib/api/tickets';
import { canCheckInForTeam } from '@/lib/auth/groups';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { emptyListCopy, matchesQuery } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';

type RecentCheckIn = CheckIn & { eventName: string; sessionTitle: string; ticketId: string };

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
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    eventsApi
      .list()
      .then((rows) => {
        const allowed = rows.filter((ev) => canCheckInForTeam(groups, ev.ownerTeam));
        setEvents(allowed);
        setEventId(allowed[0]?.id ?? '');
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi'))
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı check-in" description="Bilet kimliği ve oturum seç, kaydı yaz." />
        <StateCard title="Yükleniyor…" isLoading />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı check-in" description="Bilet kimliği ve oturum seç, kaydı yaz." />
        <StateCard
          title="Kapı için etkinlik yok"
          description="Kapı yetkisi olan bir etkinlik burada durur."
          Icon={Inbox}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kapı check-in" description="Bilet kimliği ve oturum seç, kaydı yaz." />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <form
        className="max-w-md space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const created = await ticketsApi.checkIn(ticketId.trim(), sessionId);
            const eventName = events.find((ev) => ev.id === eventId)?.name || eventId;
            const sessionTitle =
              sessions.find((session) => session.id === sessionId)?.title || sessionId;
            setResult(created);
            setRecent((prev) =>
              [
                {
                  ...created,
                  eventName,
                  sessionTitle,
                  ticketId: ticketId.trim(),
                },
                ...prev,
              ].slice(0, 8),
            );
            setTicketId('');
            setError(null);
          } catch (err) {
            setResult(null);
            setError(err instanceof ProblemError ? err.title : 'Check-in yapılamadı');
          }
        }}
      >
        <label className="block space-y-1">
          <FieldLabel>Etkinlik</FieldLabel>
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)} required>
            <option value="">Seç</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1">
          <FieldLabel>Oturum</FieldLabel>
          <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)} required>
            <option value="">Seç</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1">
          <FieldLabel>Bilet</FieldLabel>
          <Field
            placeholder="Bilet kimliği"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            required
          />
        </label>
        <SaveButton>Check-in</SaveButton>
      </form>
      {result ? (
        <div className="flex items-center gap-2">
          <StatusChip kind="checked-in" />
          <p className="text-sm text-neutral-300">
            {result.id} · {new Date(result.createdAt).toLocaleString('tr-TR')}
          </p>
        </div>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Oturum, etkinlik, bilet"
        searchLabel="Kapı kaydı ara"
      />
      <ListPanel
        status={listStatus({
          loading: false,
          rowCount: recent.filter((row) =>
            matchesQuery(query, row.sessionTitle, row.eventName, row.ticketId),
          ).length,
          emptyMessage: emptyListCopy({
            none: 'Bu oturumda henüz kapı kaydı yok.',
            noneMatch: 'Eşleşen kapı kaydı yok.',
            query,
          }),
        })}
        emptyDescription="Başarılı kayıtlar burada birikir."
        emptyIcon={CheckCircle2}
      >
        {recent
          .filter((row) => matchesQuery(query, row.sessionTitle, row.eventName, row.ticketId))
          .map((row) => (
            <ListItem
              key={row.id}
              title={row.sessionTitle}
              subtitle={`${row.eventName} · ${row.ticketId} · ${formatApplicantWhen(row.createdAt)}`}
              trailing={<StatusChip kind="checked-in" />}
            />
          ))}
      </ListPanel>
    </div>
  );
}
