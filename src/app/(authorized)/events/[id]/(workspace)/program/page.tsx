'use client';

import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, MenuItem, MenuLinkItem, cn } from '@skylab-kulubu/skylcn-ui';
import { CheckCircle2, DoorOpen, MessageSquare, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { RowMenu } from '@/components/chrome/ListPage';
import { StatusChip } from '@/components/chrome/StatusChip';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { QrPreview } from '@/components/chrome/QrPreview';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import { DatePicker } from '@/components/forms/DatePicker';
import { AttendanceQr } from '@/components/scheduling/AttendanceQr';
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { FeedbackFormPanel } from '@/components/scheduling/EventFeedbackPanel';
import { EventFormSlots } from '@/components/scheduling/EventFormSlots';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { StaticSessionQr } from '@/components/scheduling/StaticSessionQr';
import { coreProblemMessage, formInUseOf, type FormInUse } from '@/lib/core-problems';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi, type FeedbackCount } from '@/lib/api/events';
import {
  sessionsApi,
  SESSION_TYPES,
  sessionQrFileName,
  sessionQrPath,
  sessionQrUrl,
  sessionTypeLabel,
  type EventSession,
} from '@/lib/api/sessions';
import { ticketsApi, type SessionQrMode } from '@/lib/api/tickets';
import { urlsApi } from '@/lib/api/urls';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { ALREADY_CHECKED_IN, checkInSuccessLine } from '@/lib/door-check-in';
import { attachFormAliases, type EventFormSlot } from '@/lib/event-forms';
import { countedByDefault } from '@/lib/certificate-rule';
import { checkInsBySession, sessionClock, sessionNowAndNext } from '@/lib/event-overview';
import { eventDoorHref } from '@/lib/event-workspace';
import { listStatus } from '@/lib/list-status';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  closeSessionFeedbackReminders,
  sessionFeedbackFields,
  sessionFeedbackSlot,
} from '@/lib/session-feedback';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

const daySchema = z.object({
  name: z.string().trim().min(1, 'Gün adı zorunlu'),
  startDate: z.string(),
  endDate: z.string(),
});

const sessionSchema = z.object({
  eventDayId: z.string().min(1, 'Gün seç'),
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

/** Program tab: the event's days and their sessions, with check-in and session QR per session. */
export default function EventProgramPage() {
  const {
    event,
    days,
    sessions,
    tickets,
    ticketsFailed,
    error,
    setError,
    reload,
    canMutate,
    canDesk,
    canTickets,
  } = useEventWorkspace();
  const [dayOpen, setDayOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<EventSession | null>(null);
  // The session the attendance QR shows now (picked by hand or by "Programı izle"); the static QR
  // follows it.
  const [qrShown, setQrShown] = useState<{ id: string; title: string } | null>(null);
  // Core's SESSION_QR_MODE, learnt from the attendance QR; null until it answers.
  const [sessionQrMode, setSessionQrMode] = useState<SessionQrMode | null>(null);
  const [checkInSession, setCheckInSession] = useState<EventSession | null>(null);
  // A drawer's own error shows inside it; the tab's line sits behind the open drawer
  const [dayError, setDayError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionInUse, setSessionInUse] = useState<FormInUse | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const notify = useNotify();
  // The certificate marks matter only while the event gives certificates
  const hasCertificateRule = Boolean(event.attendanceRule && event.attendanceRule !== 'none');
  // A deleted session's row goes away: the drawer then returns focus to Oturum ekle
  const addSession = useRef<HTMLButtonElement>(null);
  const sessionDeleted = useRef(false);
  const [confirmDay, dayConfirm] = useConfirm();
  // The session's Sil sits in its drawer, so its question opens inside it
  const [confirmSession, sessionConfirm] = useConfirm();
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
  const deskPersonId = deskForm.watch('personId');
  // "Oturum başına form" (per_session): each Session's feedback form, in its drawer
  const perSession = event.feedbackMode === 'per_session';
  const [feedbackSlot, setFeedbackSlot] = useState<EventFormSlot | null>(null);
  const [feedbackAutoSend, setFeedbackAutoSend] = useState(true);
  const [feedbackSession, setFeedbackSession] = useState<EventSession | null>(null);
  const [feedbackCount, setFeedbackCount] = useState<FeedbackCount | null>(null);
  const sessionTitle = sessionForm.watch('title');

  function openFeedback(session: EventSession) {
    setFeedbackCount(null);
    setFeedbackSession(session);
    // The counts are the editors' and DK's; anyone else is refused and sees none
    eventsApi
      .feedbackCounts(event.id)
      .then((counts) =>
        setFeedbackCount(
          counts.sessions.find((row) => row.sessionId === session.id) ?? { sent: 0, answered: 0 },
        ),
      )
      .catch(() => setFeedbackCount(null));
  }
  const deskQuery = deskForm.watch('email');

  // A day reads as a timeline: by start time, the stored order for sessions without one
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, EventSession[]>();
    for (const session of sessions) {
      const list = map.get(session.eventDayId) ?? [];
      list.push(session);
      map.set(session.eventDayId, list);
    }
    const at = (session: EventSession) =>
      session.startTime ? Date.parse(session.startTime) : Number.POSITIVE_INFINITY;
    for (const list of map.values()) {
      list.sort((a, b) => at(a) - at(b) || a.orderIndex - b.orderIndex);
    }
    return map;
  }, [sessions]);
  const nowAndNext = useMemo(() => sessionNowAndNext(sessions), [sessions]);
  // How many came in to each session, from the registrations the reader may see
  const entries = useMemo(
    () =>
      canTickets && !ticketsFailed && tickets.length
        ? checkInsBySession(tickets)
        : new Map<string, number>(),
    [canTickets, ticketsFailed, tickets],
  );

  function editSession(session: EventSession) {
    setSessionError(null);
    setSessionInUse(null);
    setEditingSessionId(session.id);
    setFeedbackSlot(sessionFeedbackSlot(session));
    setFeedbackAutoSend(session.feedbackAutoSend ?? true);
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
    sessionDeleted.current = false;
    setSessionOpen(true);
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Günler ve oturumlar"
        actions={
          canMutate ? (
            <div className="flex gap-2">
              <ActionButton
                icon={Plus}
                label="Gün ekle"
                showLabel
                onClick={() => {
                  setDayError(null);
                  setDayOpen(true);
                }}
              />
              <ActionButton
                icon={Plus}
                variant="primary"
                label="Oturum ekle"
                ref={addSession}
                onClick={() => {
                  if (days.length === 0) {
                    setDayError(null);
                    setDayOpen(true);
                    return;
                  }
                  setSessionError(null);
                  setSessionInUse(null);
                  setEditingSessionId(null);
                  setFeedbackSlot(null);
                  sessionForm.reset(emptySession(days[0]?.id ?? ''));
                  sessionDeleted.current = false;
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
            <div key={day.id} className="border-border overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-secondary-foreground text-sm">{day.name}</p>
                  <p className="text-subtle-foreground text-[13px]/5">
                    {day.startDate
                      ? new Date(day.startDate).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          weekday: 'long',
                        })
                      : '—'}
                  </p>
                </div>
                {canMutate ? (
                  <ActionButton
                    icon={Trash2}
                    label="Günü sil"
                    onClick={() =>
                      confirmDay({
                        title: `"${day.name}" günü silinsin mi?`,
                        description: `Gün, oturumlarıyla birlikte programdan kalkar. ${UNDO_HINT}`,
                        actionLabel: 'Günü sil',
                        onConfirm: async () => {
                          await eventDaysApi.delete(day.id);
                          notify.undoable(
                            'Gün silindi',
                            async () => {
                              await eventDaysApi.restore(day.id);
                              void reload();
                            },
                            'Gün geri alındı',
                          );
                          await reload();
                        },
                        failure: 'Gün silinemedi',
                      })
                    }
                  />
                ) : null}
              </div>
              <div className="border-border-subtle border-t">
                {(sessionsByDay.get(day.id) ?? []).length === 0 ? (
                  <p className={`text-subtle-foreground px-3 py-3 ${TEXT_SECONDARY}`}>
                    {error ? 'Oturumlar yüklenemedi' : 'Oturum yok'}
                  </p>
                ) : (
                  <ol
                    className="divide-border-subtle divide-y"
                    aria-label={`${day.name} oturumları`}
                  >
                    {(sessionsByDay.get(day.id) ?? []).map((session) => {
                      const state =
                        session.id === nowAndNext.current?.id
                          ? 'now'
                          : session.id === nowAndNext.next?.id
                            ? 'next'
                            : null;
                      const entered = entries.get(session.id);
                      return (
                        <li
                          key={session.id}
                          className={cn(
                            'flex items-start gap-3 px-3 py-3 sm:items-center',
                            state === 'now' &&
                              'bg-success/10 shadow-success shadow-[inset_3px_0_0]',
                            session.cancelled && 'opacity-60',
                          )}
                        >
                          <span className="text-foreground w-[5.5rem] shrink-0 pt-0.5 text-sm font-medium tabular-nums sm:pt-0">
                            {sessionClock(session) || '—'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  'text-foreground text-sm font-medium',
                                  session.cancelled && 'line-through',
                                )}
                              >
                                {session.title}
                              </span>
                              {state === 'now' ? <StatusChip kind="live" label="Şimdi" /> : null}
                              {state === 'next' ? (
                                <StatusChip kind="upcoming" label="Sıradaki" />
                              ) : null}
                              {hasCertificateRule && !session.cancelled ? (
                                <>
                                  {session.certificateCounted === false ? (
                                    <StatusChip kind="neutral" label="Sayılmaz" />
                                  ) : null}
                                  {session.certificateRequired ? (
                                    <StatusChip kind="featured" label="Zorunlu" />
                                  ) : null}
                                </>
                              ) : null}
                            </span>
                            <span
                              className={`text-subtle-foreground block truncate ${TEXT_SECONDARY}`}
                            >
                              {[
                                session.speakerName,
                                sessionTypeLabel(session.sessionType),
                                entered !== undefined ? `${entered} giriş` : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {canDesk && !session.cancelled ? (
                              <Button
                                variant={state === 'now' ? 'primary' : 'ghost'}
                                size="sm"
                                className={`${BUTTON_TEXT} hidden sm:inline-flex`}
                                render={<Link href={eventDoorHref(event.id)} />}
                              >
                                <DoorOpen aria-hidden />
                                Kapıyı aç
                              </Button>
                            ) : null}
                            <RowMenu rowName={session.title}>
                              {canDesk && !session.cancelled ? (
                                <MenuLinkItem icon={DoorOpen} href={eventDoorHref(event.id)}>
                                  Kapıyı aç
                                </MenuLinkItem>
                              ) : null}
                              {canDesk ? (
                                <MenuItem
                                  icon={CheckCircle2}
                                  onClick={() => {
                                    setDeskError(null);
                                    deskForm.reset();
                                    setCheckInSession(session);
                                  }}
                                >
                                  Katıldı
                                </MenuItem>
                              ) : null}
                              <MenuItem icon={QrCode} onClick={() => setQrSession(session)}>
                                Oturum QR
                              </MenuItem>
                              {perSession && session.feedbackFormUrl ? (
                                <MenuItem
                                  icon={MessageSquare}
                                  onClick={() => openFeedback(session)}
                                >
                                  Geri bildirim
                                </MenuItem>
                              ) : null}
                              {canMutate ? (
                                <MenuItem icon={Pencil} onClick={() => editSession(session)}>
                                  Oturumu düzenle
                                </MenuItem>
                              ) : null}
                            </RowMenu>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <Drawer
        open={dayOpen}
        onClose={() => {
          dayForm.reset();
          setDayOpen(false);
        }}
        title="Gün ekle"
        dirty={dayForm.formState.isDirty}
      >
        <form
          className="space-y-3"
          noValidate
          onSubmit={dayForm.handleSubmit(async (day) => {
            setDayError(null);
            try {
              await eventDaysApi.create({
                eventId: event.id,
                name: day.name,
                startDate: toRfc3339(day.startDate),
                endDate: toRfc3339(day.endDate),
              });
              dayForm.reset();
              setDayOpen(false);
              notify.success('Gün eklendi');
              await reload();
            } catch (err) {
              setDayError(coreProblemMessage(err, 'Gün eklenemedi'));
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
              <span className="text-destructive text-[13px]/5">
                {dayForm.formState.errors.name.message}
              </span>
            ) : null}
          </label>
          <Controller
            control={dayForm.control}
            name="startDate"
            render={({ field }) => (
              <DatePicker label="Başlangıç" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={dayForm.control}
            name="endDate"
            render={({ field }) => (
              <DatePicker label="Bitiş" value={field.value} onChange={field.onChange} />
            )}
          />
          {dayError ? (
            <p role="alert" className="text-destructive text-sm">
              {dayError}
            </p>
          ) : null}
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
        dirty={sessionForm.formState.isDirty}
        finalFocus={() => (sessionDeleted.current ? addSession.current : null)}
      >
        <form
          className="space-y-3"
          noValidate
          onSubmit={sessionForm.handleSubmit(async (sessionDraft) => {
            setSessionError(null);
            setSessionInUse(null);
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
                // Out of the per-Session mode the fields are left out: core keeps them
                const feedback =
                  perSession && feedbackSlot
                    ? sessionFeedbackFields(
                        await sessionFeedbackWithLink(
                          { ...feedbackSlot, extra: body.title },
                          event,
                        ),
                        feedbackAutoSend,
                      )
                    : {};
                await sessionsApi.update(editingSessionId, { ...body, ...feedback });
              } else {
                // A networking Session does not count for the certificate unless the rule says so
                await sessionsApi.create({
                  ...body,
                  certificateCounted: countedByDefault(body.sessionType),
                });
              }
              setSessionOpen(false);
              notify.success(editingSessionId ? 'Oturum kaydedildi' : 'Oturum eklendi');
              await reload();
            } catch (err) {
              setSessionError(coreProblemMessage(err, 'Oturum kaydedilemedi'));
              setSessionInUse(formInUseOf(err));
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
              <span className="text-destructive text-[13px]/5">
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
              <span className="text-destructive text-[13px]/5">
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
              <span className="text-destructive text-[13px]/5">
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
          <Controller
            control={sessionForm.control}
            name="startTime"
            render={({ field }) => (
              <DatePicker label="Başlangıç" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={sessionForm.control}
            name="endTime"
            render={({ field }) => (
              <DatePicker label="Bitiş" value={field.value} onChange={field.onChange} />
            )}
          />
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
          {editingSessionId && perSession && feedbackSlot ? (
            <div className="space-y-2">
              <EventFormSlots
                slots={[{ ...feedbackSlot, extra: sessionTitle.trim() || feedbackSlot.extra }]}
                eventName={event.name}
                ownerTeam={event.ownerTeam}
                startLocal={toDatetimeLocal(event.startDate)}
                reservedEventId={event.id}
                addable={false}
                inUse={sessionInUse}
                onGateChange={(_, gate) => closeSessionFeedbackReminders(editingSessionId, gate)}
                onChange={([slot]) => {
                  if (slot) setFeedbackSlot(slot);
                }}
              />
              <Switch
                checked={feedbackAutoSend}
                onChange={setFeedbackAutoSend}
                label="Oturum bitince gönder"
                hint="Bitişten 2 saat sonra katılanlara e-postayla gider."
              />
            </div>
          ) : null}
          {editingSessionId ? (
            <button
              type="button"
              className="border-destructive/30 text-destructive h-8 rounded-md border px-3 text-[13px]"
              onClick={() => {
                const id = editingSessionId;
                const title = sessions.find((session) => session.id === id)?.title;
                confirmSession({
                  title: title ? `"${title}" oturumu silinsin mi?` : 'Oturum silinsin mi?',
                  description: `Oturum programdan kalkar. ${UNDO_HINT}`,
                  actionLabel: 'Oturumu sil',
                  onConfirm: async () => {
                    await sessionsApi.delete(id);
                    notify.undoable(
                      'Oturum silindi',
                      async () => {
                        await sessionsApi.restore(id);
                        void reload();
                      },
                      'Oturum geri alındı',
                    );
                    // The drawer, and the question inside it, close once the program shows the change
                    await reload();
                    sessionDeleted.current = true;
                    setSessionOpen(false);
                  },
                  failure: 'Oturum silinemedi',
                  closesDrawer: true,
                });
              }}
            >
              Sil
            </button>
          ) : null}
          {sessionError ? (
            <p role="alert" className="text-destructive text-sm">
              {sessionError}
            </p>
          ) : null}
          {sessionConfirm}
          <SaveButton disabled={sessionForm.formState.isSubmitting}>
            {sessionForm.formState.isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
          </SaveButton>
        </form>
      </Drawer>
      {dayConfirm}
      <Drawer
        open={feedbackSession !== null}
        onClose={() => setFeedbackSession(null)}
        title={feedbackSession ? `${feedbackSession.title} · Geri bildirim` : 'Geri bildirim'}
      >
        {feedbackSession ? (
          <FeedbackFormPanel
            url={feedbackSession.feedbackFormUrl}
            alias={feedbackSession.feedbackFormAlias}
            count={feedbackCount}
            canSend={canMutate}
            description="Katılanlara kişiye özel bağlantıyla bir kez gider."
            send={() => sessionsApi.sendFeedback(feedbackSession.id)}
          />
        ) : null}
      </Drawer>
      <Drawer
        open={qrSession !== null}
        onClose={() => {
          setQrSession(null);
          setQrShown(null);
        }}
        title={qrSession ? `${qrSession.title} QR` : 'Oturum QR'}
      >
        {qrSession ? (
          <div className="space-y-6">
            {canDesk ? (
              <AttendanceQr
                sessionId={qrSession.id}
                title={qrSession.title}
                onMode={setSessionQrMode}
                program={sessions}
                onSession={setQrShown}
              />
            ) : null}
            {canDesk && !qrSession.cancelled ? (
              <StaticSessionQr
                sessionId={qrShown?.id ?? qrSession.id}
                title={qrShown?.title ?? qrSession.title}
              />
            ) : null}
            {sessionQrMode === 'qr' ? (
              <p className="text-secondary-foreground text-sm">
                Basılı oturum QR&apos;ı artık yoklama yazmaz.
              </p>
            ) : (
              <div className="space-y-2">
                {canDesk ? (
                  <p className="text-secondary-foreground text-sm">
                    Basılı QR: sky-app&apos;in bugünkü sürümü bunu okur. Geçiş bitince kalkar.
                  </p>
                ) : null}
                <QrPreview
                  imageUrl={sessionQrUrl(qrSession.id)}
                  downloadPath={sessionQrPath(qrSession.id, { size: 1024 })}
                  fileName={sessionQrFileName(qrSession.id, qrSession.title)}
                  label={`${qrSession.title} QR`}
                />
              </div>
            )}
          </div>
        ) : null}
      </Drawer>
      <Drawer
        open={checkInSession !== null}
        onClose={() => {
          deskForm.reset();
          setCheckInSession(null);
        }}
        title={checkInSession ? `${checkInSession.title} · Katıldı` : 'Katıldı'}
        dirty={deskForm.formState.isDirty}
      >
        {checkInSession ? (
          <form
            className="space-y-3"
            noValidate
            onSubmit={deskForm.handleSubmit(async (desk) => {
              setDeskError(null);
              try {
                const created = await ticketsApi.resolveAndCheckIn(checkInSession.id, {
                  personId: desk.personId || undefined,
                  query: desk.email.trim(),
                });
                notify.success(
                  checkInSuccessLine({
                    name: created.personName,
                    sessionTitle: checkInSession.title,
                    createdAt: created.createdAt,
                  }),
                );
                setCheckInSession(null);
                await reload();
              } catch (err) {
                setDeskError(coreProblemMessage(err, 'Giriş yazılamadı', ALREADY_CHECKED_IN));
              }
            })}
          >
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
              <FieldLabel>Ad, e-posta ya da bilet kodu</FieldLabel>
              <Field
                type="text"
                placeholder="Ad, e-posta ya da bilet kodu"
                {...deskForm.register('email', {
                  onChange: () => deskForm.setValue('personId', ''),
                })}
                aria-invalid={Boolean(deskForm.formState.errors.email)}
              />
              {deskForm.formState.errors.email ? (
                <span role="alert" className="text-destructive text-[13px]/5">
                  {deskForm.formState.errors.email.message}
                </span>
              ) : null}
            </label>
            {deskError ? (
              <p role="alert" className="text-destructive text-sm">
                {deskError}
              </p>
            ) : null}
            <SaveButton disabled={deskForm.formState.isSubmitting}>
              {deskForm.formState.isSubmitting ? 'Yazılıyor…' : 'Katıldı'}
            </SaveButton>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

/** The Session's feedback form with its short link made, as the Event's forms get theirs on save. */
async function sessionFeedbackWithLink(
  slot: EventFormSlot,
  event: { name: string; ownerTeam: string; startDate?: string },
): Promise<EventFormSlot> {
  const [linked] = await attachFormAliases(
    [slot],
    event.name,
    toDatetimeLocal(event.startDate),
    (body) => urlsApi.create(body),
    event.ownerTeam,
  );
  return linked ?? slot;
}
