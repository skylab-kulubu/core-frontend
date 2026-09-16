'use client';

import { useState, useTransition, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { Form } from '@/components/forms/Form';
import { TextField } from '@/components/forms/TextField';
import { Select } from '@/components/forms/Select';
import { Checkbox } from '@/components/forms/Checkbox';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { z } from 'zod';
import { competitorsApi } from '@/lib/api/competitors';
import { usersApi } from '@/lib/api/users';
import { eventsApi } from '@/lib/api/events';
import { canManageCompetitorsForEvent } from '@/lib/utils/permissions';
import { useAuth } from '@/context/AuthContext';

import type { CoreEvent } from '@/lib/api/events';

const competitorSchema = z.object({
  userId: z.string().min(1, 'Kullanıcı seçiniz'),
  eventId: z.string().min(1, 'Etkinlik seçiniz'),
  points: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const n = typeof val === 'string' ? Number(val) : Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().min(0, 'Puan 0 veya daha büyük olmalı').optional()),
  winner: z.boolean().optional(),
});

export default function NewCompetitorPage() {
  return (
    <Suspense fallback={<CompetitorsNewSkeleton />}>
      <NewCompetitorPageContent />
    </Suspense>
  );
}

function CompetitorsNewSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Yeni Yarışmacı" />
      <div className="text-dark-500 mx-auto max-w-3xl px-2 text-sm">Yükleniyor…</div>
    </div>
  );
}

function NewCompetitorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lockedEventId = searchParams.get('eventId') || '';

  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<{ value: string; label: string }[]>([]);
  const [events, setEvents] = useState<{ value: string; label: string; type?: string }[]>([]);
  const [lockedEvent, setLockedEvent] = useState<CoreEvent | null>(null);
  const [lockedEventError, setLockedEventError] = useState<string | null>(null);
  const [lockedEventLoading, setLockedEventLoading] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    usersApi
      .getAll()
      .then((response) => {
        if (response.success && response.data) {
          setUsers(
            response.data.map((user) => ({
              value: user.id,
              label: `${user.firstName} ${user.lastName} (${user.email})`,
            })),
          );
        }
      })
      .catch((error) => {
        console.error('Users fetch error:', error);
      });
  }, []);

  useEffect(() => {
    if (!lockedEventId) {
      setLockedEvent(null);
      setLockedEventError(null);
      setLockedEventLoading(false);

      eventsApi
        .list()
        .then((rows) => {
          setEvents(
            rows.map((event) => ({
              value: event.id,
              label: event.name,
              type: event.ownerTeam,
            })),
          );
        })
        .catch((error) => {
          console.error('Events fetch error:', error);
        });
      return;
    }

    setLockedEventLoading(true);
    eventsApi
      .get(lockedEventId)
      .then((event) => {
        setLockedEvent(event);
        const allowed = canManageCompetitorsForEvent(currentUser, event.ownerTeam);
        if (!allowed) {
          setLockedEventError('Bu etkinlik için yarışmacı ekleme yetkiniz yok.');
        } else {
          setLockedEventError(null);
        }
      })
      .catch(() => {
        setLockedEvent(null);
        setLockedEventError('Etkinlik yüklenemedi.');
      })
      .finally(() => setLockedEventLoading(false));
  }, [lockedEventId, currentUser]);

  const handleSubmit = async (data: z.infer<typeof competitorSchema>) => {
    const eventType = lockedEvent?.ownerTeam ?? events.find((e) => e.value === data.eventId)?.type;
    if (!canManageCompetitorsForEvent(currentUser ?? null, eventType)) {
      router.replace(data.eventId ? `/events/${data.eventId}` : '/events');
      return;
    }
    startTransition(async () => {
      try {
        await competitorsApi.create({
          userId: data.userId,
          eventId: data.eventId,
          points: data.points,
          winner: data.winner,
        });
        router.push(`/events/${data.eventId}`);
      } catch (error) {
        console.error('Competitor creation error:', error);
        const rawMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
        const userMessage =
          rawMessage.includes('405') || rawMessage.toLowerCase().includes('method not allowed')
            ? 'Yarışmacı oluşturma şu anda desteklenmiyor. Lütfen daha sonra tekrar deneyin.'
            : rawMessage;
        alert('Yarışmacı oluşturulurken hata oluştu: ' + userMessage);
      }
    });
  };

  const filteredEvents = currentUser
    ? events.filter((e) => canManageCompetitorsForEvent(currentUser, e.type))
    : events;

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni Yarışmacı" description={lockedEvent?.name} />

      <div className="mx-auto max-w-3xl">
        <div className="bg-light border-dark-200 rounded-lg border p-4 shadow">
          <Form
            schema={competitorSchema}
            onSubmit={handleSubmit}
            defaultValues={{ eventId: lockedEventId || undefined }}
          >
            {(methods) => {
              const formErrors = methods.formState.errors;
              return (
                <>
                  {Object.keys(formErrors).length > 0 && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
                      <p className="mb-2 text-sm font-medium text-red-800">Form hataları:</p>
                      <ul className="list-inside list-disc text-sm text-red-600">
                        {Object.entries(formErrors).map(([key, error]) => (
                          <li key={key}>
                            {key}: {error?.message as string}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lockedEventError && lockedEventId && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      {lockedEventError}
                    </div>
                  )}
                  {lockedEventId && <input type="hidden" {...methods.register('eventId')} />}
                  {lockedEventId && lockedEventLoading && !lockedEventError && (
                    <div className="text-dark-600 mb-4 text-sm">Etkinlik bilgisi yükleniyor…</div>
                  )}
                  {lockedEvent && lockedEventId && !lockedEventError && (
                    <div className="border-dark-200 bg-dark-50 mb-5 rounded-lg border px-4 py-3 text-sm">
                      <span className="text-dark-500 block text-xs">Etkinlik</span>
                      <p className="text-dark-900 mt-0.5 font-medium">{lockedEvent.name}</p>
                    </div>
                  )}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-dark-800 mb-3 text-sm font-semibold">Temel Bilgiler</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Select name="userId" label="Kullanıcı" options={users} required />
                        {!lockedEventId && (
                          <Select
                            name="eventId"
                            label="Etkinlik"
                            options={filteredEvents}
                            required
                          />
                        )}
                        <TextField name="points" label="Puan" type="number" placeholder="100" />
                        <div className="flex items-end">
                          <Checkbox name="winner" label="Kazanan" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <FormActions
                    cancel={
                      <Button
                        href={lockedEventId ? `/events/${lockedEventId}` : '/competitors'}
                        variant="outlineDanger"
                      >
                        İptal
                      </Button>
                    }
                    submit={
                      <Button
                        type="submit"
                        variant="outlineBrand"
                        disabled={
                          isPending || !!lockedEventError || (!!lockedEventId && lockedEventLoading)
                        }
                      >
                        {isPending ? 'Kaydediliyor...' : 'Kaydet'}
                      </Button>
                    }
                  />
                </>
              );
            }}
          </Form>
        </div>
      </div>
    </div>
  );
}
