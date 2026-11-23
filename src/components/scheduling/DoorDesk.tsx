'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { buttonVariants, cn, TaskPage } from '@skylab-kulubu/skylcn-ui';
import { ArrowLeft, CheckCircle2, Inbox } from 'lucide-react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
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
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { DoorAttendeePick } from '@/components/scheduling/DoorAttendeePick';
import { GuestDoorQr } from '@/components/scheduling/GuestDoorQr';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventDaysApi } from '@/lib/api/eventDays';
import { type EventSession } from '@/lib/api/sessions';
import { ticketsApi, type DoorEvent } from '@/lib/api/tickets';
import {
  ALREADY_CHECKED_IN,
  checkInSuccessLine,
  defaultDoorSessionId,
  doorSessionLabel,
  doorSessionTiming,
} from '@/lib/door-check-in';
import { eventTabHref } from '@/lib/event-workspace';
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
    sessionId: z.string().min(1, 'Girişin yazılacağı oturumu seçin'),
    personId: z.string(),
    email: z.string().trim(),
  })
  .refine((value) => value.personId !== '' || value.email !== '', {
    message: 'Kişi veya e-posta girin',
    path: ['email'],
  });

type DoorForm = z.infer<typeof doorSchema>;

/**
 * The door of one event, a page of its own without the sidebar: back to the
 * event on top, then the session, the person and the live count.
 */
export function DoorDesk({ eventId }: { eventId: string }) {
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  // A refused check-in shows under the button, where the operator is looking
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [successLine, setSuccessLine] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCheckIn[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const {
    register,
    control,
    watch,
    setValue,
    resetField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DoorForm>({
    resolver: zodResolver(doorSchema),
    defaultValues: { eventId: '', sessionId: '', personId: '', email: '' },
  });
  const sessionId = watch('sessionId');
  const personId = watch('personId');
  const doorQuery = watch('email');

  useEffect(() => {
    ticketsApi
      .listDoorEvents()
      .then((rows) => {
        setEvents(rows);
      })
      .catch((err) => setError(coreProblemMessage(err, 'Etkinlikler yüklenemedi')))
      .finally(() => setLoading(false));
  }, []);

  // The form writes to the event of the address, once core lists it among the person's doors
  const event = events.find((row) => row.id === eventId);
  useEffect(() => {
    setValue('eventId', event ? event.id : '');
  }, [event, setValue]);
  const formEventId = watch('eventId');
  useChromeCrumbName(`/events/${eventId}`, event?.name);

  useEffect(() => {
    resetField('personId');
    resetField('email');
    setSuccessLine(null);
    setCheckInError(null);
    setSessions([]);
    setValue('sessionId', '');
    setRecent([]);
    setActivityTotal(0);
    setActivityError(null);
    if (!formEventId) {
      return;
    }
    let cancelled = false;
    eventDaysApi
      .listByEvent(formEventId)
      .then(async (days) => {
        const nested = await Promise.all(days.map((day) => eventDaysApi.listSessions(day.id)));
        if (cancelled) return;
        const rows = nested.flat();
        setSessions(rows);
        setValue('sessionId', defaultDoorSessionId(rows));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(coreProblemMessage(err, 'Oturumlar yüklenemedi'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [formEventId, resetField, setValue]);

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
            setActivityError(coreProblemMessage(err, 'Canlı kapı kayıtları yüklenemedi'));
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

  const selectedSession = sessions.find((session) => session.id === sessionId);
  // Never blocks: says why nothing is chosen, or that the chosen session is not running now.
  const sessionNote =
    !sessionId && sessions.length > 0
      ? 'Girişin yazılacağı oturumu seçin: şu an süren tek bir oturum yok.'
      : doorSessionTiming(selectedSession);

  // Back to the event on top: the door is reached from it, and left for it
  const shell = (body: ReactNode) => (
    <TaskPage
      title="Kapı"
      size="lg"
      framed={false}
      className="sm:justify-start"
      brand={
        <Link
          href={eventTabHref(eventId)}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 max-w-full')}
        >
          <ArrowLeft aria-hidden />
          <span className="truncate">{event?.name ?? 'Etkinliğe dön'}</span>
        </Link>
      }
    >
      {body}
    </TaskPage>
  );

  if (loading) {
    return shell(<StateCard title="Yükleniyor…" isLoading />);
  }

  if (error && events.length === 0) {
    return shell(
      <div role="alert">
        <StateCard title={error} description="Bağlantıyı kontrol edip tekrar deneyin." />
      </div>,
    );
  }

  if (!event) {
    return shell(<StateCard title="Bu etkinlik için kapı yetkisi yok" Icon={Inbox} />);
  }

  return shell(
    <>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {activityError ? (
        <p role="alert" className="text-destructive text-sm">
          {activityError}
        </p>
      ) : null}
      <form
        className="space-y-3"
        noValidate
        onSubmit={handleSubmit(async (form) => {
          setCheckInError(null);
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
          } catch (err) {
            setSuccessLine(null);
            setCheckInError(coreProblemMessage(err, 'Check-in yapılamadı', ALREADY_CHECKED_IN));
          }
        })}
      >
        <div className="space-y-1">
          <label className="block space-y-1">
            <FieldLabel>Oturum</FieldLabel>
            {/* Controlled, so the picker always shows the session the check-in is sent to. */}
            <Controller
              control={control}
              name="sessionId"
              render={({ field }) => (
                <Select
                  {...field}
                  aria-invalid={Boolean(errors.sessionId)}
                  aria-describedby={
                    errors.sessionId || sessionNote ? 'door-session-note' : undefined
                  }
                >
                  <option value="">Oturum seçin</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {doorSessionLabel(session)}
                    </option>
                  ))}
                </Select>
              )}
            />
          </label>
          {errors.sessionId ? (
            <p id="door-session-note" role="alert" className="text-destructive text-[13px]/5">
              {errors.sessionId.message}
            </p>
          ) : sessionNote ? (
            <p id="door-session-note" className="text-muted-foreground text-[13px]/5">
              {sessionNote}
            </p>
          ) : null}
        </div>
        <DoorAttendeePick
          eventId={formEventId}
          valueKey={personId || doorQuery}
          onPick={(attendee) => {
            setValue('personId', attendee.personId ?? '', { shouldValidate: true });
            setValue('email', attendee.personId ? '' : attendee.email || attendee.name, {
              shouldValidate: true,
            });
          }}
        />
        <label className="block space-y-1">
          <FieldLabel>Ad, e-posta ya da bilet kodu</FieldLabel>
          <Field
            type="text"
            placeholder="Ad, e-posta ya da bilet kodu"
            {...register('email', { onChange: () => setValue('personId', '') })}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? (
            <span role="alert" className="text-destructive text-[13px]/5">
              {errors.email.message}
            </span>
          ) : null}
        </label>
        <SaveButton disabled={isSubmitting}>{isSubmitting ? 'Yazılıyor…' : 'Check-in'}</SaveButton>
        {checkInError ? (
          <p role="alert" className="text-destructive text-sm">
            {checkInError}
          </p>
        ) : null}
        {/* Under the button, in view on a phone; always mounted so each line is read out */}
        <div role="status" aria-label="Check-in sonucu" className="flex items-center gap-2">
          {successLine ? (
            <>
              <StatusChip kind="checked-in" />
              <p className="text-secondary-foreground text-sm">{successLine}</p>
            </>
          ) : null}
        </div>
      </form>
      <GuestDoorQr sessionId={sessionId} />
      <p
        role="status"
        aria-label="Canlı check-in sayısı"
        className="text-secondary-foreground text-sm"
      >
        {sessionId
          ? `${selectedSession?.title ?? 'Bu oturum'} · canlı toplam: ${activityTotal}`
          : 'Oturum seçilmedi'}
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
    </>,
  );
}
