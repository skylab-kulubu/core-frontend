'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
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
import { TextArea } from '@/components/chrome/TextArea';
import { DatePicker } from '@/components/forms/DatePicker';
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
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
import { toDatetimeLocal, toRfc3339 } from '@/lib/datetime-local';
import { checkInSuccessLine } from '@/lib/door-check-in';
import { listStatus } from '@/lib/list-status';

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
  const {
    event,
    days,
    sessions,
    error,
    setError,
    deskNote,
    setDeskNote,
    reload,
    canMutate,
    canDesk,
  } = useEventWorkspace();
  const [dayOpen, setDayOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<EventSession | null>(null);
  const [checkInSession, setCheckInSession] = useState<EventSession | null>(null);
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
                    onClick={async () => {
                      try {
                        await eventDaysApi.delete(day.id);
                        await reload();
                      } catch (err) {
                        setError(err instanceof ProblemError ? err.title : 'Gün silinemedi');
                      }
                    }}
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
              await reload();
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
              await reload();
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
          {editingSessionId ? (
            <button
              type="button"
              className="border-destructive/30 text-destructive h-8 rounded-md border px-3 text-xs"
              onClick={async () => {
                try {
                  await sessionsApi.delete(editingSessionId);
                  setSessionOpen(false);
                  await reload();
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
                await reload();
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
                <span role="alert" className="text-2xs text-destructive">
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
