'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Inbox } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { type EventSession } from '@/lib/api/sessions';
import { ticketsApi, type DoorEvent } from '@/lib/api/tickets';
import { checkInSuccessLine } from '@/lib/door-check-in';
import { emptyListCopy, matchesQuery } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';

type RecentCheckIn = {
  id: string;
  name: string;
  eventName: string;
  sessionTitle: string;
  createdAt: string;
};

const doorSchema = z
  .object({
    eventId: z.string().min(1, 'Etkinlik seçin'),
    sessionId: z.string().min(1, 'Oturum seçin'),
    personId: z.string(),
    email: z.string().trim(),
  })
  .refine((value) => value.personId !== '' || value.email !== '', {
    message: 'Kişi veya e-posta girin',
    path: ['email'],
  });

type DoorForm = z.infer<typeof doorSchema>;

export default function QrPage() {
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [successLine, setSuccessLine] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const {
    register,
    watch,
    setValue,
    resetField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DoorForm>({
    resolver: zodResolver(doorSchema),
    defaultValues: { eventId: '', sessionId: '', personId: '', email: '' },
  });
  const eventId = watch('eventId');
  const sessionId = watch('sessionId');
  const personId = watch('personId');
  const doorQuery = watch('email');

  useEffect(() => {
    ticketsApi
      .listDoorEvents()
      .then((rows) => {
        setEvents(rows);
        const requested =
          typeof window === 'undefined'
            ? ''
            : new URLSearchParams(window.location.search).get('eventId')?.trim() || '';
        setValue(
          'eventId',
          rows.some((event) => event.id === requested) ? requested : (rows[0]?.id ?? ''),
        );
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi'))
      .finally(() => setLoading(false));
  }, [setValue]);

  useEffect(() => {
    resetField('personId');
    resetField('email');
    setSuccessLine(null);
    setSessions([]);
    setValue('sessionId', '');
    setRecent([]);
    setActivityTotal(0);
    setActivityError(null);
    if (!eventId) {
      return;
    }
    let cancelled = false;
    eventDaysApi
      .listByEvent(eventId)
      .then(async (days) => {
        const nested = await Promise.all(days.map((day) => eventDaysApi.listSessions(day.id)));
        if (cancelled) return;
        const rows = nested.flat();
        setSessions(rows);
        setValue('sessionId', rows[0]?.id ?? '');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ProblemError ? err.title : 'Oturumlar yüklenemedi');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, resetField, setValue]);

  useEffect(() => {
    if (!sessionId) {
      setRecent([]);
      setActivityTotal(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void ticketsApi
        .doorActivity(sessionId)
        .then((activity) => {
          if (cancelled) return;
          const eventName = events.find((event) => event.id === eventId)?.name || eventId;
          const sessionTitle =
            sessions.find((session) => session.id === sessionId)?.title || sessionId;
          setActivityTotal(activity.total);
          setActivityError(null);
          setRecent(
            activity.items.map((item) => ({
              id: item.id,
              name: item.personName,
              eventName,
              sessionTitle,
              createdAt: item.createdAt,
            })),
          );
        })
        .catch((err) => {
          if (!cancelled) {
            setActivityError(
              err instanceof ProblemError ? err.title : 'Canlı kapı kayıtları yüklenemedi',
            );
          }
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [eventId, events, sessionId, sessions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı check-in" description="Kişi veya e-posta ile oturuma yaz." />
        <StateCard title="Yükleniyor…" isLoading />
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı check-in" description="Kişi veya e-posta ile oturuma yaz." />
        <div role="alert">
          <StateCard title={error} description="Bağlantıyı kontrol edip tekrar deneyin." />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kapı check-in" description="Kişi veya e-posta ile oturuma yaz." />
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
      <PageHeader title="Kapı check-in" description="Kişi veya e-posta ile oturuma yaz." />
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {activityError ? (
        <p role="alert" className="text-sm text-red-300">
          {activityError}
        </p>
      ) : null}
      <form
        className="max-w-md space-y-3"
        noValidate
        onSubmit={handleSubmit(async (form) => {
          try {
            const created = await ticketsApi.resolveAndCheckIn(form.sessionId, {
              personId: form.personId || undefined,
              query: form.email.trim(),
            });
            const eventName = events.find((ev) => ev.id === form.eventId)?.name || form.eventId;
            const sessionTitle =
              sessions.find((session) => session.id === form.sessionId)?.title || form.sessionId;
            const name = created.personName;
            const line = checkInSuccessLine({
              name,
              sessionTitle,
              createdAt: created.createdAt,
            });
            setSuccessLine(line);
            setRecent((prev) =>
              [
                {
                  id: created.id,
                  name,
                  eventName,
                  sessionTitle,
                  createdAt: created.createdAt,
                },
                ...prev,
              ].slice(0, 8),
            );
            setActivityTotal((total) => total + 1);
            resetField('personId');
            resetField('email');
            setError(null);
          } catch (err) {
            setSuccessLine(null);
            setError(
              err instanceof ProblemError && err.title === 'Ambiguous Match'
                ? 'Bu adla birden fazla bilet var; e-posta ile deneyin.'
                : err instanceof ProblemError
                  ? err.title
                  : 'Check-in yapılamadı',
            );
          }
        })}
      >
        <label className="block space-y-1">
          <FieldLabel>Etkinlik</FieldLabel>
          <Select {...register('eventId')} aria-invalid={Boolean(errors.eventId)}>
            <option value="">Seç</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </Select>
          {errors.eventId ? (
            <span role="alert" className="text-2xs text-red-300">
              {errors.eventId.message}
            </span>
          ) : null}
        </label>
        <label className="block space-y-1">
          <FieldLabel>Oturum</FieldLabel>
          <Select {...register('sessionId')} aria-invalid={Boolean(errors.sessionId)}>
            <option value="">Seç</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </Select>
          {errors.sessionId ? (
            <span role="alert" className="text-2xs text-red-300">
              {errors.sessionId.message}
            </span>
          ) : null}
        </label>
        <DoorAttendeePick
          eventId={eventId}
          valueKey={personId || doorQuery}
          onPick={(attendee) => {
            setValue('personId', attendee.personId ?? '', { shouldValidate: true });
            setValue('email', attendee.personId ? '' : attendee.email || attendee.name, {
              shouldValidate: true,
            });
          }}
        />
        <label className="block space-y-1">
          <FieldLabel>Ad veya e-posta</FieldLabel>
          <Field
            type="text"
            placeholder="Ad veya e-posta"
            {...register('email', { onChange: () => setValue('personId', '') })}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? (
            <span role="alert" className="text-2xs text-red-300">
              {errors.email.message}
            </span>
          ) : null}
        </label>
        <SaveButton disabled={isSubmitting}>{isSubmitting ? 'Yazılıyor…' : 'Check-in'}</SaveButton>
      </form>
      {successLine ? (
        <div role="status" aria-label="Check-in sonucu" className="flex items-center gap-2">
          <StatusChip kind="checked-in" />
          <p className="text-sm text-neutral-300">{successLine}</p>
        </div>
      ) : null}
      <p role="status" aria-label="Canlı check-in sayısı" className="text-sm text-neutral-300">
        Bu oturumda canlı toplam: {activityTotal}
      </p>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Oturum, etkinlik, kişi"
        searchLabel="Kapı kaydı ara"
      />
      <ListPanel
        status={listStatus({
          loading: false,
          rowCount: recent.filter((row) =>
            matchesQuery(query, row.sessionTitle, row.eventName, row.name),
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
          .filter((row) => matchesQuery(query, row.sessionTitle, row.eventName, row.name))
          .map((row) => (
            <ListItem
              key={row.id}
              title={row.name}
              subtitle={checkInSuccessLine({
                name: row.sessionTitle,
                sessionTitle: row.eventName,
                createdAt: row.createdAt,
              })}
              trailing={<StatusChip kind="checked-in" />}
            />
          ))}
      </ListPanel>
    </div>
  );
}
