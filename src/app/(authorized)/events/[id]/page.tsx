'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Mail, Pencil, Plus, QrCode, Trash2, Trophy } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { MixChart, SectionHeading } from '@/components/chrome/PanelChart';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { TextArea } from '@/components/chrome/TextArea';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { AddParticipantDrawer } from '@/components/scheduling/AddParticipantDrawer';
import { ApplicantRoster } from '@/components/scheduling/ApplicantRoster';
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { EventWorkspaceNav } from '@/components/scheduling/EventWorkspaceNav';
import { QrPreview } from '@/components/chrome/QrPreview';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi, type EventDay } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import {
  canAssignEventTicket,
  canDeskCheckIn,
  canListEventTickets,
  ticketOwnerPeople,
} from '@/lib/tickets-ui';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import {
  sessionsApi,
  SESSION_TYPES,
  sessionQrFileName,
  sessionQrPath,
  sessionQrUrl,
  sessionTypeLabel,
  type EventSession,
} from '@/lib/api/sessions';
import { checkInSuccessLine, doorTicketName } from '@/lib/door-check-in';
import { personLabel } from '@/components/identity/PersonPick';
import { teamsApi } from '@/lib/api/teams';
import { identityApi, type Person } from '@/lib/api/identity';
import {
  canManageCompetitors,
  canWriteEvent,
  isPrivileged,
  leaderOwnerTeams,
} from '@/lib/auth/groups';
import { DatePicker } from '@/components/forms/DatePicker';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import { formHandoffFromSearch } from '@/lib/event-forms';
import { clearEventDraft, formStateFromEvent, restoreEventEditor } from '@/lib/event-draft';
import { publicMediaUrl } from '@/lib/event-media';
import { openEventMail } from '@/lib/event-mail';
import { eventFormIssue, eventListSubtitle } from '@/lib/events-view';
import { publicShortUrl } from '@/lib/api/urls';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { listStatus } from '@/lib/list-status';
import { ticketCheckInMix, ticketMix } from '@/lib/panel-charts';
import { useAuth } from '@/context/AuthContext';

const daySchema = z.object({
  name: z.string().trim().min(1, 'Gün adı zorunlu'),
  startDate: z.string(),
  endDate: z.string(),
});

const sessionSchema = z.object({
  eventDayId: z.string().min(1, 'Gün seçin'),
  title: z.string().trim().min(1, 'Başlık zorunlu'),
  speakerName: z.string().trim().min(1, 'Konuşmacı zorunlu'),
  speakerLinkedin: z.string().trim(),
  description: z.string().trim(),
  startTime: z.string(),
  endTime: z.string(),
  orderIndex: z.number(),
  sessionType: z.string().min(1),
});

const deskSchema = z
  .object({ personId: z.string(), email: z.string().trim() })
  .refine((value) => value.personId !== '' || value.email !== '', {
    message: 'Kişi veya e-posta girin',
    path: ['email'],
  });

const eventEditSchema = z
  .object({ event: z.custom<EventFormState>() })
  .superRefine(({ event }, context) => {
    const issue = eventFormIssue(event);
    if (issue) context.addIssue({ code: 'custom', message: issue, path: ['event'] });
  });

type SessionDraft = z.infer<typeof sessionSchema>;

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
  const [people, setPeople] = useState<Person[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<EventSession | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [mailing, setMailing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [checkInSession, setCheckInSession] = useState<EventSession | null>(null);
  const [deskNote, setDeskNote] = useState<string | null>(null);
  const [doorAccess, setDoorAccess] = useState(false);
  const dayForm = useForm<z.infer<typeof daySchema>>({
    resolver: zodResolver(daySchema),
    defaultValues: { name: '', startDate: '', endDate: '' },
  });
  const sessionForm = useForm<SessionDraft>({
    resolver: zodResolver(sessionSchema),
    defaultValues: emptySession(),
  });
  const deskForm = useForm<z.infer<typeof deskSchema>>({
    resolver: zodResolver(deskSchema),
    defaultValues: { personId: '', email: '' },
  });
  const eventEditForm = useForm<z.infer<typeof eventEditSchema>>({
    resolver: zodResolver(eventEditSchema),
    defaultValues: { event: emptyEventForm() },
  });
  const form = eventEditForm.watch('event');
  const deskPersonId = deskForm.watch('personId');
  const deskQuery = deskForm.watch('email');

  const canMutate = event ? canWriteEvent(groups, event.ownerTeam, 'update') : false;
  const canDelete = event ? canWriteEvent(groups, event.ownerTeam, 'delete') : false;
  const canCompetitors = event ? canManageCompetitors(groups, event.ownerTeam) : false;
  const canTickets = event ? canListEventTickets(groups, event.ownerTeam) : false;
  const canAssign = event ? canAssignEventTicket(groups, event.ownerTeam) : false;
  const canDesk = event ? canDeskCheckIn(groups, event.ownerTeam) || doorAccess : false;

  async function load() {
    try {
      const ev = await eventsApi.get(id);
      const loaded = formStateFromEvent(ev);
      const handoff =
        typeof window === 'undefined'
          ? null
          : formHandoffFromSearch(new URLSearchParams(window.location.search));
      const nextForm = restoreEventEditor(
        typeof window === 'undefined' ? null : sessionStorage,
        typeof window === 'undefined' ? `/events/${id}` : window.location.href,
        loaded,
        handoff,
      );
      setEvent(ev);
      const doorEvents = await ticketsApi.listDoorEvents().catch(() => []);
      setDoorAccess(doorEvents.some((doorEvent) => doorEvent.id === ev.id));
      eventEditForm.reset({ event: nextForm });
      setError(null);
      if (handoff && canWriteEvent(groups, ev.ownerTeam, 'update')) {
        setEditing(true);
        try {
          await saveEventWithSeason(nextForm, ev.id);
          window.history.replaceState(null, '', `/events/${ev.id}`);
          const saved = await eventsApi.get(id);
          setEvent(saved);
          eventEditForm.reset({
            event: {
              ...formStateFromEvent(saved),
              formUrl: saved.formUrl ?? nextForm.formUrl,
              formAlias: saved.formAlias ?? nextForm.formAlias,
              extraFormUrls: saved.extraFormUrls ?? nextForm.extraFormUrls,
              coverImageId: saved.coverImageId ?? nextForm.coverImageId,
            },
          });
          clearEventDraft(sessionStorage, window.location.href);
          setHandoffNote('Skyforms adresi bağlandı. Kısa link kayıtta skyl.app’den basılır.');
        } catch (err) {
          setError(err instanceof ProblemError ? err.title : 'Form adresi kaydedilemedi');
        }
      }
      const dayRows = await eventDaysApi.listByEvent(id);
      const sessionRows = (
        await Promise.all(dayRows.map((day) => eventDaysApi.listSessions(day.id)))
      ).flat();
      setDays(dayRows);
      setSessions(sessionRows);
      setCompetitors(await competitorsApi.listByEvent(id).catch(() => []));
      const ticketRows = canListEventTickets(groups, ev.ownerTeam)
        ? await ticketsApi.listByEvent(id).catch(() => [] as Ticket[])
        : [];
      setTickets(ticketRows);
      const directoryPeople = privileged ? await identityApi.listUsers().catch(() => []) : [];
      const knownPeople = new Map(directoryPeople.map((person) => [person.id, person]));
      for (const [personId, person] of ticketOwnerPeople(ticketRows)) {
        knownPeople.set(personId, person);
      }
      setPeople([...knownPeople.values()]);
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
  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const myTicket = Boolean(
    (user?.id && tickets.some((row) => row.ownerId === user.id)) || applyNote,
  );

  if (error && !event) {
    return <StateCard title={error} description="Etkinlik kartına dönemiyor." tone="danger" />;
  }
  if (!event) return <StateCard title="Yükleniyor…" isLoading />;

  const current = event;
  async function mailApplicants(ticketIds?: string[]) {
    setMailing(true);
    try {
      await openEventMail(
        current.id,
        (eventId) => eventsApi.syncMailList(eventId, ticketIds),
        (href) => {
          window.open(href, '_blank', 'noopener,noreferrer');
        },
      );
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Skymail listesi yenilenemedi');
    } finally {
      setMailing(false);
    }
  }

  return (
    <div className="space-y-6">
      <span id="overview" className="-mb-6 block scroll-mt-24" />
      <PageHeader
        title={event.name}
        description={eventListSubtitle(event)}
        meta={
          <>
            <StatusChip kind={event.active ? 'active' : 'passive'} />
            {canTickets ? <StatusChip kind="neutral" label={`${tickets.length} başvuru`} /> : null}
          </>
        }
        actions={
          <>
            {canMutate ? (
              <ActionButton icon={Pencil} label="Düzenle" onClick={() => setEditing(true)} />
            ) : null}
            {canTickets ? (
              <ActionButton
                icon={Mail}
                label="Etkinlik katılımcılarına mail"
                disabled={mailing}
                onClick={() => void mailApplicants()}
              />
            ) : null}
            {canDelete ? (
              <ActionButton
                icon={Trash2}
                label="Sil"
                onClick={async () => {
                  if (!window.confirm('Bu etkinliği silmek istediğine emin misin?')) return;
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
      <EventWorkspaceNav
        eventId={event.id}
        canSeeParticipants={canTickets}
        canSeeCompetitors={canCompetitors}
        canUseDoor={canDesk}
      />
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {handoffNote ? <p className="text-skylab-300 text-sm">{handoffNote}</p> : null}
      {deskNote ? (
        <p role="status" aria-label="Check-in sonucu" className="text-skylab-300 text-sm">
          {deskNote}
        </p>
      ) : null}
      {event.coverImageUrl ? (
        <img
          src={publicMediaUrl(event.coverImageUrl)}
          alt=""
          className="h-40 w-full rounded-lg object-cover"
        />
      ) : null}
      <p className="text-sm whitespace-pre-wrap text-neutral-400">{event.description || '—'}</p>
      {user ? (
        <div className="space-y-2 rounded-lg border border-white/10 p-3">
          <p className="text-sm text-neutral-200">Üye kaydı</p>
          <p className="text-3xs text-neutral-500">
            Giriş yapmış kişiler public forma düşmez. Ticket hesabınla yazılır.
          </p>
          {myTicket ? (
            <p className="text-skylab-300 text-sm">Bu etkinliğe kayıtlısın.</p>
          ) : (
            <SaveButton
              type="button"
              disabled={applying}
              onClick={async () => {
                setApplying(true);
                try {
                  await ticketsApi.applyMe(event.id);
                  setApplyNote('Bu etkinliğe kayıtlısın.');
                  if (canTickets) {
                    setTickets(await ticketsApi.listByEvent(event.id).catch(() => tickets));
                  }
                } catch (err) {
                  if (err instanceof ProblemError && err.status === 409) {
                    setApplyNote('Bu etkinliğe kayıtlısın.');
                  } else {
                    setError(err instanceof ProblemError ? err.title : 'Kayıt olunamadı');
                  }
                } finally {
                  setApplying(false);
                }
              }}
            >
              {applying ? 'Kaydediliyor…' : 'Hesabınla kaydol'}
            </SaveButton>
          )}
          {event.formAlias || event.formUrl ? (
            <p className="text-3xs text-neutral-500">
              Misafir başvurusu (hesabı olmayanlar):{' '}
              <a
                className="text-skylab-300 hover:text-skylab-200"
                href={event.formAlias ? publicShortUrl(event.formAlias) : event.formUrl}
                target="_blank"
                rel="noreferrer"
              >
                {event.formAlias ? publicShortUrl(event.formAlias) : event.formUrl}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      <div id="competitors" className="scroll-mt-24 space-y-3">
        <SectionHeading
          title="Yarışmacılar"
          meta={`${competitors.length} kişi`}
          actions={
            canCompetitors ? (
              <ActionButton
                icon={Trophy}
                variant="primary"
                label="Yarışmacı ekle"
                href={`/competitors/new?eventId=${encodeURIComponent(event.id)}`}
              />
            ) : null
          }
        />
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: competitors.length,
            emptyMessage: 'Yarışmacı yok',
          })}
          emptyDescription="Puan ve kazananı burada işaretle."
        >
          {competitors.map((row) => {
            const person = personById.get(row.userId);
            return (
              <ListItem
                key={row.id}
                href={`/competitors/${row.id}/edit?eventId=${encodeURIComponent(event.id)}`}
                title={person ? personLabel(person) : row.userId}
                subtitle={row.score !== undefined ? String(row.score) : '—'}
                trailing={row.isWinner ? <StatusChip kind="winner" /> : undefined}
              />
            );
          })}
        </ListPanel>
      </div>
      {canTickets ? (
        <div id="participants" className="scroll-mt-24 space-y-3">
          <SectionHeading title="Başvuranlar" meta={`${tickets.length} kayıt`} />
          {tickets.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <MixChart title="Misafir / üye" data={ticketMix(tickets)} empty="Başvuru yok" />
              <MixChart
                title="Kapı durumu"
                data={ticketCheckInMix(tickets)}
                empty="Kapı kaydı yok"
              />
            </div>
          ) : null}
          <ApplicantRoster
            eventId={event.id}
            tickets={tickets}
            people={personById}
            event={event}
            sessions={sessions.map((session) => ({ id: session.id, title: session.title }))}
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
                      setDeskNote(
                        checkInSuccessLine({
                          name: doorTicketName(ticket, personById),
                          sessionTitle,
                          createdAt: created.createdAt,
                        }),
                      );
                      await load();
                    } catch (err) {
                      setError(err instanceof ProblemError ? err.title : 'Check-in yapılamadı');
                    }
                  }
                : undefined
            }
          />
        </div>
      ) : null}
      <span id="program" className="-mb-6 block scroll-mt-24" />
      <SectionHeading
        title="Günler ve oturumlar"
        actions={
          canMutate ? (
            <div className="flex gap-2">
              <ActionButton icon={Plus} label="Gün ekle" onClick={() => setDayOpen(true)} />
              <ActionButton
                icon={Plus}
                variant="primary"
                label="Oturum ekle"
                onClick={() => {
                  if (days.length === 0) {
                    setDayOpen(true);
                    return;
                  }
                  setEditingSessionId(null);
                  sessionForm.reset(emptySession(days[0]?.id ?? ''));
                  setSessionOpen(true);
                }}
              />
            </div>
          ) : null
        }
      />
      <div className="space-y-4">
        {days.length === 0 ? (
          <ListPanel
            status={listStatus({
              loading: false,
              failed: Boolean(error),
              rowCount: 0,
              emptyMessage: 'Henüz gün yok.',
            })}
          />
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
              <div className="border-t border-white/5">
                <ListPanel
                  framed={false}
                  status={listStatus({
                    loading: false,
                    failed: Boolean(error),
                    rowCount: (sessionsByDay.get(day.id) ?? []).length,
                    emptyMessage: 'Oturum yok',
                  })}
                >
                  {(sessionsByDay.get(day.id) ?? []).map((session) => (
                    <ListItem
                      key={session.id}
                      title={session.title}
                      subtitle={`${session.speakerName} · ${sessionTypeLabel(session.sessionType)}`}
                      trailing={
                        <div className="flex items-center gap-1">
                          <StatusChip
                            kind="neutral"
                            label={sessionTypeLabel(session.sessionType)}
                          />
                          {canDesk ? (
                            <ActionButton
                              icon={CheckCircle2}
                              label="Katıldı"
                              onClick={() => {
                                setDeskNote(null);
                                deskForm.reset();
                                setCheckInSession(session);
                              }}
                            />
                          ) : null}
                          <ActionButton
                            icon={QrCode}
                            label="Oturum QR"
                            onClick={() => setQrSession(session)}
                          />
                          {canMutate ? (
                            <ActionButton
                              icon={Pencil}
                              label="Oturumu düzenle"
                              onClick={() => {
                                setEditingSessionId(session.id);
                                sessionForm.reset({
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
                          ) : null}
                        </div>
                      }
                    />
                  ))}
                </ListPanel>
              </div>
            </div>
          ))
        )}
      </div>
      <Drawer open={editing} onClose={() => setEditing(false)} title="Etkinliği düzenle">
        <form
          className="space-y-3"
          noValidate
          onSubmit={eventEditForm.handleSubmit(async ({ event: eventForm }) => {
            try {
              await saveEventWithSeason(eventForm, event.id);
              if (typeof window !== 'undefined') {
                clearEventDraft(sessionStorage, window.location.href);
              }
              setEditing(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Kaydedilemedi');
            }
          })}
        >
          <EventEditor
            value={form}
            onChange={(value) =>
              eventEditForm.setValue('event', value, {
                shouldDirty: true,
                shouldValidate: eventEditForm.formState.isSubmitted,
              })
            }
            ownerOptions={ownerOptions}
            lockOwner={!privileged}
            seasons={seasons}
            showSeason={privileged}
            ownerOptional={privileged}
            assignDoorStaff={privileged}
            knownMedia={[
              ...(event.coverImageId
                ? [{ id: event.coverImageId, name: 'Kapak', url: event.coverImageUrl }]
                : []),
              ...(event.images ?? []).map((image) => ({ id: image.id, url: image.url })),
            ]}
            returnTo={typeof window !== 'undefined' ? window.location.href : ''}
          />
          {eventEditForm.formState.errors.event ? (
            <p className="text-2xs text-red-300">{eventEditForm.formState.errors.event.message}</p>
          ) : null}
          <SaveButton disabled={eventEditForm.formState.isSubmitting}>
            {eventEditForm.formState.isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
          </SaveButton>
        </form>
      </Drawer>
      <Drawer
        open={dayOpen}
        onClose={() => {
          dayForm.reset();
          setDayOpen(false);
        }}
        title="Gün ekle"
      >
        <form
          className="space-y-3"
          noValidate
          onSubmit={dayForm.handleSubmit(async (day) => {
            try {
              await eventDaysApi.create({
                eventId: event.id,
                name: day.name,
                startDate: toRfc3339(day.startDate),
                endDate: toRfc3339(day.endDate),
              });
              dayForm.reset();
              setDayOpen(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Gün eklenemedi');
            }
          })}
        >
          <label className="block space-y-1">
            <FieldLabel>Gün adı</FieldLabel>
            <Field
              {...dayForm.register('name')}
              aria-invalid={Boolean(dayForm.formState.errors.name)}
            />
            {dayForm.formState.errors.name ? (
              <span className="text-2xs text-red-300">{dayForm.formState.errors.name.message}</span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>Başlangıç</FieldLabel>
            <Controller
              control={dayForm.control}
              name="startDate"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Bitiş</FieldLabel>
            <Controller
              control={dayForm.control}
              name="endDate"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
          </label>
          <SaveButton disabled={dayForm.formState.isSubmitting}>
            {dayForm.formState.isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
          </SaveButton>
        </form>
      </Drawer>
      <Drawer
        open={sessionOpen}
        onClose={() => {
          sessionForm.reset(emptySession());
          setSessionOpen(false);
        }}
        title={editingSessionId ? 'Oturumu düzenle' : 'Oturum ekle'}
      >
        <form
          className="space-y-3"
          noValidate
          onSubmit={sessionForm.handleSubmit(async (sessionDraft) => {
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
          })}
        >
          <label className="block space-y-1">
            <FieldLabel>Gün</FieldLabel>
            <Select
              {...sessionForm.register('eventDayId')}
              aria-invalid={Boolean(sessionForm.formState.errors.eventDayId)}
            >
              <option value="">Seç</option>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name}
                </option>
              ))}
            </Select>
            {sessionForm.formState.errors.eventDayId ? (
              <span className="text-2xs text-red-300">
                {sessionForm.formState.errors.eventDayId.message}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>Başlık</FieldLabel>
            <Field
              {...sessionForm.register('title')}
              aria-invalid={Boolean(sessionForm.formState.errors.title)}
            />
            {sessionForm.formState.errors.title ? (
              <span className="text-2xs text-red-300">
                {sessionForm.formState.errors.title.message}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>Konuşmacı</FieldLabel>
            <Field
              {...sessionForm.register('speakerName')}
              aria-invalid={Boolean(sessionForm.formState.errors.speakerName)}
            />
            {sessionForm.formState.errors.speakerName ? (
              <span className="text-2xs text-red-300">
                {sessionForm.formState.errors.speakerName.message}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>LinkedIn</FieldLabel>
            <Field {...sessionForm.register('speakerLinkedin')} />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Açıklama</FieldLabel>
            <TextArea rows={3} {...sessionForm.register('description')} />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Başlangıç</FieldLabel>
            <Controller
              control={sessionForm.control}
              name="startTime"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Bitiş</FieldLabel>
            <Controller
              control={sessionForm.control}
              name="endTime"
              render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Tür</FieldLabel>
            <Select {...sessionForm.register('sessionType')}>
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {sessionTypeLabel(type)}
                </option>
              ))}
            </Select>
          </label>
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
          <SaveButton disabled={sessionForm.formState.isSubmitting}>
            {sessionForm.formState.isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
          </SaveButton>
        </form>
      </Drawer>
      <Drawer
        open={qrSession !== null}
        onClose={() => setQrSession(null)}
        title={qrSession ? `${qrSession.title} QR` : 'Oturum QR'}
      >
        {qrSession ? (
          <QrPreview
            imageUrl={sessionQrUrl(qrSession.id)}
            downloadPath={sessionQrPath(qrSession.id, { size: 1024 })}
            fileName={sessionQrFileName(qrSession.id, qrSession.title)}
            label={`${qrSession.title} QR`}
          />
        ) : null}
      </Drawer>
      <AddParticipantDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        eventId={event.id}
        onCreated={async () => {
          await load();
        }}
      />
      <Drawer
        open={checkInSession !== null}
        onClose={() => {
          deskForm.reset();
          setCheckInSession(null);
        }}
        title={checkInSession ? `${checkInSession.title} · Katıldı` : 'Katıldı'}
      >
        {checkInSession ? (
          <form
            className="space-y-3"
            noValidate
            onSubmit={deskForm.handleSubmit(async (desk) => {
              try {
                const created = await ticketsApi.resolveAndCheckIn(checkInSession.id, {
                  personId: desk.personId || undefined,
                  query: desk.email.trim(),
                });
                setDeskNote(
                  checkInSuccessLine({
                    name: created.personName,
                    sessionTitle: checkInSession.title,
                    createdAt: created.createdAt,
                  }),
                );
                setCheckInSession(null);
                await load();
              } catch (err) {
                setError(err instanceof ProblemError ? err.title : 'Check-in yapılamadı');
              }
            })}
          >
            {deskNote ? <p className="text-skylab-300 text-sm">{deskNote}</p> : null}
            <DoorAttendeePick
              eventId={event.id}
              valueKey={deskPersonId || deskQuery}
              onPick={(attendee) => {
                deskForm.setValue('personId', attendee.personId ?? '', { shouldValidate: true });
                deskForm.setValue(
                  'email',
                  attendee.personId ? '' : attendee.email || attendee.name,
                  { shouldValidate: true },
                );
              }}
            />
            <label className="block space-y-1">
              <FieldLabel>Ad veya e-posta</FieldLabel>
              <Field
                type="text"
                placeholder="Ad veya e-posta"
                {...deskForm.register('email', {
                  onChange: () => deskForm.setValue('personId', ''),
                })}
                aria-invalid={Boolean(deskForm.formState.errors.email)}
              />
              {deskForm.formState.errors.email ? (
                <span role="alert" className="text-2xs text-red-300">
                  {deskForm.formState.errors.email.message}
                </span>
              ) : null}
            </label>
            <SaveButton disabled={deskForm.formState.isSubmitting}>
              {deskForm.formState.isSubmitting ? 'Yazılıyor…' : 'Katıldı'}
            </SaveButton>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}
