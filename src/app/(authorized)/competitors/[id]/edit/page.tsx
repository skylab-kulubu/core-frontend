'use client';

import { useState, useTransition, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { Form } from '@/components/forms/Form';
import { TextField } from '@/components/forms/TextField';
import { Select } from '@/components/forms/Select';
import { Checkbox } from '@/components/forms/Checkbox';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { z } from 'zod';
import { competitorsApi } from '@/lib/api/competitors';
import { usersApi } from '@/lib/api/users';
import { eventsApi } from '@/lib/api/events';
import { canManageCompetitorsForEvent } from '@/lib/utils/permissions';
import type { CompetitorDto, EventDto } from '@/types/api';
import { useAuth } from '@/context/AuthContext';

import { Modal } from '@/components/ui/Modal';
import { HiOutlineTrash } from 'react-icons/hi2';

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

export default function EditCompetitorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<CompetitorEditSkeleton />}>
      <EditCompetitorPageContent params={params} />
    </Suspense>
  );
}

function CompetitorEditSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Yarışmacı Düzenle" />
      <div className="text-dark-500 mx-auto max-w-2xl px-2 text-sm">Yükleniyor…</div>
    </div>
  );
}

function EditCompetitorPageContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEventId = searchParams.get('eventId')?.trim() ?? '';

  const { id } = use(params);
  const [isPending, startTransition] = useTransition();
  const [competitor, setCompetitor] = useState<CompetitorDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ value: string; label: string }[]>([]);
  const [eventFromApi, setEventFromApi] = useState<EventDto | null>(null);
  const { user: currentUser } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const resolvedEventId = competitor?.event?.id || queryEventId;
  const resolvedEventTypeName = competitor?.event?.type?.name || eventFromApi?.type?.name;

  useEffect(() => {
    if (!id) return;

    Promise.all([competitorsApi.getById(id), usersApi.getAll()])
      .then(([competitorResponse, usersResponse]) => {
        if (competitorResponse.success && competitorResponse.data) {
          setCompetitor(competitorResponse.data);
        } else {
          setError('Yarışmacı bulunamadı');
        }
        if (usersResponse.success && usersResponse.data) {
          setUsers(
            usersResponse.data.map((user) => ({
              value: user.id,
              label: `${user.firstName} ${user.lastName}`,
            })),
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Competitor fetch error:', err);
        setError('Yarışmacı yüklenirken hata oluştu');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    const needEvent = queryEventId && (!competitor?.event?.name || !competitor?.event?.type?.name);
    if (!needEvent) {
      if (!queryEventId) setEventFromApi(null);
      return;
    }
    eventsApi
      .get(queryEventId)
      .then((res) => {
        setEventFromApi({
          id: res.id,
          name: res.name,
          type: { id: res.ownerTeam, name: res.ownerTeam },
        } as EventDto);
      })
      .catch(() => setEventFromApi(null));
  }, [queryEventId, competitor?.event?.name, competitor?.event?.type?.name]);

  const cancelHref = resolvedEventId ? `/events/${resolvedEventId}` : '/competitors';

  useEffect(() => {
    if (loading || !competitor) return;
    const typeName = competitor.event?.type?.name || eventFromApi?.type?.name;
    if (!canManageCompetitorsForEvent(currentUser, typeName)) {
      const fallback = competitor.event?.id || queryEventId;
      router.replace(fallback ? `/events/${fallback}` : '/competitors');
    }
  }, [loading, competitor, currentUser, eventFromApi?.type?.name, queryEventId, router]);

  const handleSubmit = async (data: z.infer<typeof competitorSchema>) => {
    if (!competitor) return;

    const eventId = resolvedEventId || data.eventId;
    if (!eventId) {
      alert('Etkinlik bilgisi eksik. Bu sayfayı etkinlik kartındaki düzenle bağlantısıyla açın.');
      return;
    }

    if (!canManageCompetitorsForEvent(currentUser, resolvedEventTypeName)) {
      router.replace(`/events/${eventId}`);
      return;
    }

    startTransition(async () => {
      try {
        await competitorsApi.update(id, {
          userId: data.userId,
          eventId,
          points: data.points,
          winner: data.winner,
        });
        router.push(`/events/${eventId}`);
      } catch (error) {
        console.error('Competitor update error:', error);
        alert(
          error instanceof Error
            ? `Güncellenemedi: ${error.message}`
            : 'Yarışmacı güncellenirken hata oluştu.',
        );
      }
    });
  };

  const handleDelete = async () => {
    if (!canManageCompetitorsForEvent(currentUser, resolvedEventTypeName)) {
      router.replace(cancelHref);
      return;
    }
    setIsDeleting(true);
    try {
      const response = await competitorsApi.delete(id);
      if (response.success) {
        router.push(cancelHref);
      } else {
        console.error('Delete failed:', response);
        alert(response.message || 'Silinemedi.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(error instanceof Error ? error.message : 'Silinirken hata oluştu.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const pointsInitial = competitor?.score ?? competitor?.points;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="py-8 text-center">Yükleniyor...</div>
      </div>
    );
  }

  if (error || !competitor) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-red-800">Hata</h2>
          <p className="text-red-700">{error || 'Yarışmacı bulunamadı'}</p>
          <Button
            href={queryEventId ? `/events/${queryEventId}` : '/competitors'}
            variant="secondary"
            className="mt-4"
          >
            Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  const canManageThisCompetitor = canManageCompetitorsForEvent(currentUser, resolvedEventTypeName);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yarışmacı Düzenle"
        description={
          competitor.user ? `${competitor.user.firstName} ${competitor.user.lastName}` : undefined
        }
        actions={
          canManageThisCompetitor ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
              className="flex cursor-pointer items-center justify-center !border-0 !bg-transparent !px-3 !py-3 hover:!bg-transparent"
              aria-label="Yarışmacıyı sil"
            >
              <HiOutlineTrash className="text-danger h-5 w-5" />
            </Button>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-2xl">
        <div className="bg-light border-dark-200 rounded-lg border p-4 shadow">
          <Form
            schema={competitorSchema}
            onSubmit={handleSubmit}
            defaultValues={{
              userId: competitor.user?.id || '',
              eventId: resolvedEventId,
              points:
                typeof pointsInitial === 'number'
                  ? pointsInitial
                  : pointsInitial !== undefined && pointsInitial !== null
                    ? Number(pointsInitial)
                    : undefined,
              winner: competitor.winner || false,
            }}
          >
            {(methods) => {
              const formErrors = methods.formState.errors;
              return (
                <>
                  {Object.keys(formErrors).length > 0 && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
                      <p className="mb-2 text-sm font-medium text-red-800">Form hataları:</p>
                      <ul className="list-inside list-disc text-sm text-red-600">
                        {Object.entries(formErrors).map(([key, err]) => (
                          <li key={key}>
                            {key}: {err?.message as string}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {resolvedEventId ? (
                    <div className="border-dark-200 bg-dark-50 mb-5 rounded-lg border px-4 py-3 text-sm">
                      <span className="text-dark-500 block text-xs">Kayıtlı etkinlik</span>
                      <p className="text-dark-900 mt-0.5 font-medium">
                        {competitor.event?.name || eventFromApi?.name || '—'}
                      </p>
                      <input type="hidden" {...methods.register('eventId')} />
                    </div>
                  ) : null}
                  {!resolvedEventId ? (
                    <p className="text-danger mb-4 text-sm">
                      Etkinlik seçilemedi; bu sayfayı etkinlik detayındaki düzenle ikonundan açın.
                    </p>
                  ) : null}
                  <div className="space-y-4">
                    <Select name="userId" label="Kullanıcı" options={users} required />
                    <TextField name="points" label="Puan" type="number" placeholder="100" />
                    <div className="flex items-end">
                      <Checkbox name="winner" label="Kazanan" />
                    </div>
                  </div>
                  <FormActions
                    cancel={
                      <Button href={cancelHref} variant="outlineDanger">
                        İptal
                      </Button>
                    }
                    submit={
                      <Button
                        type="submit"
                        variant="outlineBrand"
                        disabled={isPending || !resolvedEventId}
                      >
                        {isPending ? 'Güncelleniyor...' : 'Güncelle'}
                      </Button>
                    }
                  />
                </>
              );
            }}
          </Form>
        </div>
      </div>
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Yarışmacıyı Sil"
      >
        <p>Bu yarışmacıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
        <ModalDangerActions
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          isPending={isDeleting}
        />
      </Modal>
    </div>
  );
}
