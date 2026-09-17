'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, QrCode, Trash2, Trophy } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { Select } from '@/components/chrome/Select';
import { TextArea } from '@/components/chrome/TextArea';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi, type EventDay } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { sessionsApi, SESSION_TYPES, type EventSession } from '@/lib/api/sessions';
import { teamsApi } from '@/lib/api/teams';
import {
  canCheckInForTeam,
  canManageCompetitors,
  canWriteEvent,
  isPrivileged,
  leaderOwnerTeams,
} from '@/lib/auth/groups';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { saveClass, saveEventWithSeason } from '@/lib/scheduling/save-event';
import { useAuth } from '@/context/AuthContext';

type SessionDraft = {
  eventDayId: string;
  title: string;
  speakerName: string;
  speakerLinkedin: string;
  description: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
  sessionType: string;
};

const emptySession = (eventDayId = ''): SessionDraft => ({
  eventDayId,
  title: '',
  speakerName: '',
  speakerLinkedin: '',
  description: '',
  startTime: '',
  endTime: '',
  orderIndex: 0,
  sessionType: 'WORKSHOP',
});

function ticketLabel(row: Ticket): string {
  if (row.ticketType === 'GUEST') {
    const name = [row.guestFirstName, row.guestLastName].filter(Boolean).join(' ');
    return name || row.guestEmail || row.id;
  }
  return row.ownerId || row.id;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const privileged = isPrivileged(groups);
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [days, setDays] = useState<EventDay[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EventFormState>(emptyEventForm());
  const [dayOpen, setDayOpen] = useState(false);
  const [dayName, setDayName] = useState('');
  const [dayStart, setDayStart] = useState('');
  const [dayEnd, setDayEnd] = useState('');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(emptySession());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const canMutate = event ? canWriteEvent(groups, event.ownerTeam, 'update') : false;
  const canDelete = event ? canWriteEvent(groups, event.ownerTeam, 'delete') : false;
  const canCompetitors = event ? canManageCompetitors(groups, event.ownerTeam) : false;
  const canTickets = event ? canCheckInForTeam(groups, event.ownerTeam) : false;

  async function load() {
    try {
      const ev = await eventsApi.get(id);
      const dayRows = await eventDaysApi.listByEvent(id);
      const sessionRows = (
        await Promise.all(dayRows.map((day) => eventDaysApi.listSessions(day.id)))
      ).flat();
      setEvent(ev);
      setDays(dayRows);
      setSessions(sessionRows);
      setCompetitors(await competitorsApi.listByEvent(id).catch(() => []));
      setTickets(
        canCheckInForTeam(groups, ev.ownerTeam)
          ? await ticketsApi.listByEvent(id).catch(() => [])
          : [],
      );
      setForm({
        ...emptyEventForm(ev.ownerTeam),
        name: ev.name,
        description: ev.description,
        location: ev.location,
        ownerTeam: ev.ownerTeam,
        formUrl: ev.formUrl ?? '',
        capacity: ev.capacity,
        startDate: toDatetimeLocal(ev.startDate),
        endDate: toDatetimeLocal(ev.endDate),
        linkedin: ev.linkedin ?? '',
        active: ev.active,
        ranked: ev.ranked,
        prizeInfo: ev.prizeInfo ?? '',
        seasonId: ev.seasonId ?? '',
        coverImageId: ev.coverImageId ?? '',
        imageIds: (ev.images ?? []).map((image) => image.id),
        attendanceRule: ev.attendanceRule ?? 'none',
        attendanceRatio: ev.attendanceRatio,
        doorStaffIds: ev.doorStaffIds ?? [],
      });
      setError(null);
      const teams = await teamsApi.list().catch(() => []);
      const leaderTeams = leaderOwnerTeams(groups);
      setOwnerOptions(
        privileged
          ? [...new Set([...teams.map((t) => t.team), ...leaderTeams, ev.ownerTeam])]
          : leaderTeams.length
            ? leaderTeams
            : [ev.ownerTeam],
      );
      if (privileged) setSeasons(await seasonsApi.list().catch(() => []));
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Etkinlik yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, EventSession[]>();
    for (const session of sessions) {
      const list = map.get(session.eventDayId) ?? [];
      list.push(session);
      map.set(session.eventDayId, list);
    }
    return map;
  }, [sessions]);

  if (error && !event) return <p className="text-sm text-red-300">{error}</p>;
  if (!event) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.name}
        description={`${event.ownerTeam}${event.location ? ` · ${event.location}` : ''}`}
        actions={
          <>
            {canMutate ? (
              <ActionButton icon={Pencil} label="Düzenle" onClick={() => setEditing(true)} />
            ) : null}
            {canDelete ? (
              <ActionButton
                icon={Trash2}
                label="Sil"
                onClick={async () => {
                  try {
                    await eventsApi.delete(event.id);
                    router.push('/events');
                  } catch (err) {
                    setError(err instanceof ProblemError ? err.title : 'Silinemedi');
                  }
                }}
              />
            ) : null}
          </>
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <p className="text-sm whitespace-pre-wrap text-neutral-400">{event.description || '—'}</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Yarışmacılar</h2>
          {canCompetitors ? (
            <ActionButton
              icon={Trophy}
              variant="primary"
              label="Yarışmacı ekle"
              href={`/competitors/new?eventId=${encodeURIComponent(event.id)}`}
            />
          ) : null}
        </div>
        <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
          {competitors.map((row) => (
            <ListItem
              key={row.id}
              href={`/competitors/${row.id}/edit?eventId=${encodeURIComponent(event.id)}`}
              title={row.userId}
              subtitle={
                row.isWinner ? 'kazanan' : row.score !== undefined ? String(row.score) : '—'
              }
            />
          ))}
        </div>
      </div>
      {canTickets ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Biletler</h2>
            <ActionButton icon={QrCode} label="QR / check-in" href="/qr" />
          </div>
          <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
            {tickets.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-neutral-500">Henüz başvuru yok.</p>
            ) : (
              tickets.map((row) => (
                <ListItem
                  key={row.id}
                  title={ticketLabel(row)}
                  subtitle={`${row.ticketType} · ${row.checkIns?.length ?? 0} check-in · ${row.id}`}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Günler ve oturumlar
        </h2>
        {canMutate ? (
          <div className="flex gap-2">
            <ActionButton icon={Plus} label="Gün ekle" onClick={() => setDayOpen(true)} />
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Oturum ekle"
              onClick={() => {
                setEditingSessionId(null);
                setSessionDraft(emptySession(days[0]?.id ?? ''));
                setSessionOpen(true);
              }}
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-4">
        {days.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz gün yok.</p>
        ) : (
          days.map((day) => (
            <div key={day.id} className="overflow-hidden rounded-lg border border-white/10">
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm text-neutral-200">{day.name}</p>
                  <p className="text-3xs text-neutral-500">
                    {day.startDate ? new Date(day.startDate).toLocaleString('tr-TR') : '—'}
                  </p>
                </div>
                {canMutate ? (
                  <ActionButton
                    icon={Trash2}
                    label="Günü sil"
                    onClick={async () => {
                      try {
                        await eventDaysApi.delete(day.id);
                        await load();
                      } catch (err) {
                        setError(err instanceof ProblemError ? err.title : 'Gün silinemedi');
                      }
                    }}
                  />
                ) : null}
              </div>
              <div className="divide-y divide-white/5 border-t border-white/5">
                {(sessionsByDay.get(day.id) ?? []).map((session) => (
                  <ListItem
                    key={session.id}
                    title={session.title}
                    subtitle={`${session.speakerName} · ${session.sessionType}`}
                    trailing={
                      canMutate ? (
                        <ActionButton
                          icon={Pencil}
                          label="Oturumu düzenle"
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setSessionDraft({
                              eventDayId: session.eventDayId,
                              title: session.title,
                              speakerName: session.speakerName,
                              speakerLinkedin: session.speakerLinkedin ?? '',
                              description: session.description ?? '',
                              startTime: toDatetimeLocal(session.startTime),
                              endTime: toDatetimeLocal(session.endTime),
                              orderIndex: session.orderIndex,
                              sessionType: session.sessionType,
                            });
                            setSessionOpen(true);
                          }}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <Drawer open={editing} onClose={() => setEditing(false)} title="Etkinliği düzenle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await saveEventWithSeason(form, event.id);
              setEditing(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Kaydedilemedi');
            }
          }}
        >
          <EventEditor
            value={form}
            onChange={setForm}
            ownerOptions={ownerOptions}
            lockOwner={!privileged}
            seasons={seasons}
            showSeason={privileged}
            ownerOptional={privileged}
            assignDoorStaff={privileged}
          />
          <button type="submit" className={saveClass}>
            Kaydet
          </button>
        </form>
      </Drawer>
      <Drawer open={dayOpen} onClose={() => setDayOpen(false)} title="Gün ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await eventDaysApi.create({
                eventId: event.id,
                name: dayName.trim(),
                startDate: toRfc3339(dayStart),
                endDate: toRfc3339(dayEnd),
              });
              setDayName('');
              setDayStart('');
              setDayEnd('');
              setDayOpen(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Gün eklenemedi');
            }
          }}
        >
          <Field
            placeholder="Gün adı"
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
            required
          />
          <Field
            type="datetime-local"
            value={dayStart}
            onChange={(e) => setDayStart(e.target.value)}
          />
          <Field type="datetime-local" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
          <button type="submit" className={saveClass}>
            Kaydet
          </button>
        </form>
      </Drawer>
      <Drawer
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        title={editingSessionId ? 'Oturumu düzenle' : 'Oturum ekle'}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const body = {
                eventDayId: sessionDraft.eventDayId,
                title: sessionDraft.title.trim(),
                speakerName: sessionDraft.speakerName.trim(),
                speakerLinkedin: sessionDraft.speakerLinkedin || undefined,
                description: sessionDraft.description || undefined,
                startTime: toRfc3339(sessionDraft.startTime),
                endTime: toRfc3339(sessionDraft.endTime),
                orderIndex: sessionDraft.orderIndex,
                sessionType: sessionDraft.sessionType,
              };
              if (editingSessionId) {
                await sessionsApi.update(editingSessionId, body);
              } else {
                await sessionsApi.create(body);
              }
              setSessionOpen(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Oturum kaydedilemedi');
            }
          }}
        >
          <Select
            value={sessionDraft.eventDayId}
            onChange={(e) => setSessionDraft({ ...sessionDraft, eventDayId: e.target.value })}
            required
          >
            <option value="">Gün</option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {day.name}
              </option>
            ))}
          </Select>
          <Field
            placeholder="Başlık"
            value={sessionDraft.title}
            onChange={(e) => setSessionDraft({ ...sessionDraft, title: e.target.value })}
            required
          />
          <Field
            placeholder="Konuşmacı"
            value={sessionDraft.speakerName}
            onChange={(e) => setSessionDraft({ ...sessionDraft, speakerName: e.target.value })}
            required
          />
          <Field
            placeholder="Konuşmacı LinkedIn"
            value={sessionDraft.speakerLinkedin}
            onChange={(e) => setSessionDraft({ ...sessionDraft, speakerLinkedin: e.target.value })}
          />
          <TextArea
            placeholder="Açıklama"
            rows={3}
            value={sessionDraft.description}
            onChange={(e) => setSessionDraft({ ...sessionDraft, description: e.target.value })}
          />
          <Field
            type="datetime-local"
            value={sessionDraft.startTime}
            onChange={(e) => setSessionDraft({ ...sessionDraft, startTime: e.target.value })}
          />
          <Field
            type="datetime-local"
            value={sessionDraft.endTime}
            onChange={(e) => setSessionDraft({ ...sessionDraft, endTime: e.target.value })}
          />
          <Select
            value={sessionDraft.sessionType}
            onChange={(e) => setSessionDraft({ ...sessionDraft, sessionType: e.target.value })}
          >
            {SESSION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          {editingSessionId ? (
            <button
              type="button"
              className="h-8 rounded-md border border-red-400/30 px-3 text-xs text-red-300"
              onClick={async () => {
                try {
                  await sessionsApi.delete(editingSessionId);
                  setSessionOpen(false);
                  await load();
                } catch (err) {
                  setError(err instanceof ProblemError ? err.title : 'Oturum silinemedi');
                }
              }}
            >
              Sil
            </button>
          ) : null}
          <button type="submit" className={saveClass}>
            Kaydet
          </button>
        </form>
      </Drawer>
    </div>
  );
}
