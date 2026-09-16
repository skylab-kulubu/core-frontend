'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { Select } from '@/components/chrome/Select';
import { TextArea } from '@/components/chrome/TextArea';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi, type EventDay } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { sessionsApi, SESSION_TYPES, type SessionRow } from '@/lib/api/sessions';
import { canWriteEvent } from '@/lib/auth/groups';
import { toRfc3339 } from '@/lib/datetime-local';
import { saveClass } from '@/lib/scheduling/save-event';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 10;

export default function SessionsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [days, setDays] = useState<EventDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState('');
  const [eventDayId, setEventDayId] = useState('');
  const [title, setTitle] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [speakerLinkedin, setSpeakerLinkedin] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sessionType, setSessionType] = useState<(typeof SESSION_TYPES)[number]>('WORKSHOP');

  const writableEvents = events.filter((ev) => canWriteEvent(groups, ev.ownerTeam, 'create'));

  async function load() {
    try {
      const eventRows = await eventsApi.list();
      setEvents(eventRows);
      setRows(await sessionsApi.listAll(eventRows));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Oturumlar yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!eventId) {
      setDays([]);
      setEventDayId('');
      return;
    }
    eventDaysApi
      .listByEvent(eventId)
      .then((list) => {
        setDays(list);
        setEventDayId(list[0]?.id ?? '');
      })
      .catch(() => setDays([]));
  }, [eventId]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oturumlar"
        description="Oturumlar bir etkinlik gününe bağlıdır."
        actions={
          writableEvents.length > 0 ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Oturum ekle"
              onClick={() => {
                setEventId(writableEvents[0]?.id ?? '');
                setTitle('');
                setSpeakerName('');
                setSpeakerLinkedin('');
                setDescription('');
                setStartTime('');
                setEndTime('');
                setSessionType('WORKSHOP');
                setOpen(true);
              }}
            />
          ) : undefined
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {slice.map((session) => (
          <ListItem
            key={session.id}
            href={`/events/${session.eventId}`}
            title={session.title}
            subtitle={`${session.eventName} · ${session.dayName} · ${session.speakerName}`}
          />
        ))}
      </div>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
      <Drawer open={open} onClose={() => setOpen(false)} title="Oturum ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await sessionsApi.create({
                eventDayId,
                title: title.trim(),
                speakerName: speakerName.trim(),
                speakerLinkedin: speakerLinkedin || undefined,
                description: description || undefined,
                startTime: toRfc3339(startTime),
                endTime: toRfc3339(endTime),
                orderIndex: 0,
                sessionType,
              });
              setOpen(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
            }
          }}
        >
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)} required>
            <option value="">Etkinlik</option>
            {writableEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </Select>
          <Select value={eventDayId} onChange={(e) => setEventDayId(e.target.value)} required>
            <option value="">Gün</option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {day.name}
              </option>
            ))}
          </Select>
          <Field
            placeholder="Başlık"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Field
            placeholder="Konuşmacı"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            required
          />
          <Field
            placeholder="LinkedIn"
            value={speakerLinkedin}
            onChange={(e) => setSpeakerLinkedin(e.target.value)}
          />
          <TextArea
            placeholder="Açıklama"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Field
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Field
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <Select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as (typeof SESSION_TYPES)[number])}
          >
            {SESSION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <button type="submit" className={saveClass}>
            Kaydet
          </button>
        </form>
      </Drawer>
    </div>
  );
}
