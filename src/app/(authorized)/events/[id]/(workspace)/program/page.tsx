'use client';

import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, MessageSquare, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { QrPreview } from '@/components/chrome/QrPreview';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import { DatePicker } from '@/components/forms/DatePicker';
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { FeedbackFormPanel } from '@/components/scheduling/EventFeedbackPanel';
import { EventFormSlots } from '@/components/scheduling/EventFormSlots';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { coreProblemMessage } from '@/lib/core-problems';
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
import { ticketsApi } from '@/lib/api/tickets';
import { urlsApi } from '@/lib/api/urls';
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { ALREADY_CHECKED_IN, checkInSuccessLine } from '@/lib/door-check-in';
import { attachFormAliases, type EventFormSlot } from '@/lib/event-forms';
import { listStatus } from '@/lib/list-status';
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
  const { event, days, sessions, error, setError, reload, canMutate, canDesk } =
    useEventWorkspace();
  const [dayOpen, setDayOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<EventSession | null>(null);
  const [checkInSession, setCheckInSession] = useState<EventSession | null>(null);
  // A drawer's own error shows inside it; the tab's line sits behind the open drawer
  const [dayError, setDayError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const notify = useNotify();
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

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, EventSession[]>();
    for (const session of sessions) {
      const list = map.get(session.eventDayId) ?? [];
      list.push(session);
      map.set(session.eventDayId, list);
    }
    return map;
  }, [sessions]);

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
                  <p className="text-3xs text-subtle-foreground">
                    {day.startDate ? new Date(day.startDate).toLocaleString('tr-TR') : '—'}
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
                                setDeskError(null);
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
                          {perSession && session.feedbackFormUrl ? (
                            <ActionButton
                              icon={MessageSquare}
                              label="Geri bildirim"
                              onClick={() => openFeedback(session)}
                            />
                          ) : null}
                          {canMutate ? (
                            <ActionButton
                              icon={Pencil}
                              label="Oturumu düzenle"
                              onClick={() => {
                                setSessionError(null);
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
              <span className="text-2xs text-destructive">
                {dayForm.formState.errors.name.message}
              </span>
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
        finalFocus={() => (sessionDeleted.current ? addSession.current : null)}
      >
        <form
          className="space-y-3"
          noValidate
          onSubmit={sessionForm.handleSubmit(async (sessionDraft) => {
            setSessionError(null);
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
                await sessionsApi.create(body);
              }
              setSessionOpen(false);
              notify.success(editingSessionId ? 'Oturum kaydedildi' : 'Oturum eklendi');
              await reload();
            } catch (err) {
              setSessionError(coreProblemMessage(err, 'Oturum kaydedilemedi'));
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
              <span className="text-2xs text-destructive">
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
              <span className="text-2xs text-destructive">
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
              <span className="text-2xs text-destructive">
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
          {editingSessionId && perSession && feedbackSlot ? (
            <div className="space-y-2">
              <EventFormSlots
                slots={[{ ...feedbackSlot, extra: sessionTitle.trim() || feedbackSlot.extra }]}
                eventName={event.name}
                ownerTeam={event.ownerTeam}
                startLocal={toDatetimeLocal(event.startDate)}
                reservedEventId={event.id}
                addable={false}
                onGateChange={(_, gate) => closeSessionFeedbackReminders(editingSessionId, gate)}
                onChange={([slot]) => {
                  if (slot) setFeedbackSlot(slot);
                }}
              />
              <Switch
                checked={feedbackAutoSend}
                onChange={setFeedbackAutoSend}
                label="Oturum bitince gönder"
                hint="Bitişten 2 saat sonra oturumun yoklamasına posta gider; cevaplamayanlara 3 gün sonra bir hatırlatma."
              />
            </div>
          ) : null}
          {editingSessionId ? (
            <button
              type="button"
              className="border-destructive/30 text-destructive h-8 rounded-md border px-3 text-xs"
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
            description="Oturumun yoklamasına kişiye özel bağlantıyla posta gider. Form bir kez gönderilir; oturum bitince yeniden gitmez."
            send={() => sessionsApi.sendFeedback(feedbackSession.id)}
          />
        ) : null}
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
                setDeskError(coreProblemMessage(err, 'Check-in yapılamadı', ALREADY_CHECKED_IN));
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
                <span role="alert" className="text-2xs text-destructive">
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
