'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { Select } from '@/components/chrome/Select';
import { TextArea } from '@/components/chrome/TextArea';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi, type EventDay } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { sessionsApi, SESSION_TYPES, sessionTypeLabel, type SessionRow } from '@/lib/api/sessions';
import { canWriteEvent } from '@/lib/auth/groups';
import { toRfc3339 } from '@/lib/datetime-local';
import { SaveButton } from '@/components/chrome/SaveButton';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 10;

export default function SessionsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
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
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: rows.length,
          emptyMessage: 'Oturum yok',
        })}
      >
        {slice.map((session) => (
          <ListItem
            key={session.id}
            href={`/events/${session.eventId}`}
            title={session.title}
            subtitle={`${session.eventName} · ${session.dayName} · ${session.speakerName}`}
          />
        ))}
      </ListPanel>
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
          <label className="block space-y-1">
            <FieldLabel>Etkinlik</FieldLabel>
            <Select value={eventId} onChange={(e) => setEventId(e.target.value)} required>
              <option value="">Seç</option>
              {writableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <FieldLabel>Gün</FieldLabel>
            <Select value={eventDayId} onChange={(e) => setEventDayId(e.target.value)} required>
              <option value="">Seç</option>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <FieldLabel>Başlık</FieldLabel>
            <Field value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Konuşmacı</FieldLabel>
            <Field value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>LinkedIn</FieldLabel>
            <Field value={speakerLinkedin} onChange={(e) => setSpeakerLinkedin(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Açıklama</FieldLabel>
            <TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Başlangıç</FieldLabel>
            <Field
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Bitiş</FieldLabel>
            <Field
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Tür</FieldLabel>
            <Select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as (typeof SESSION_TYPES)[number])}
            >
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {sessionTypeLabel(type)}
                </option>
              ))}
            </Select>
          </label>
          <SaveButton>Kaydet</SaveButton>
        </form>
      </Drawer>
    </div>
  );
}
