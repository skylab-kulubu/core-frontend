'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { Form } from '@/components/forms/Form';
import { TextField } from '@/components/forms/TextField';
import { Textarea } from '@/components/forms/Textarea';
import { Select } from '@/components/forms/Select';
import { FileUpload } from '@/components/forms/FileUpload';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { Toggle } from '@/components/ui/Toggle';
import { z } from 'zod';
import { announcementsApi } from '@/lib/api/announcements';
import { eventTypesApi } from '@/lib/api/event-types';
import type { AnnouncementDto } from '@/types/api';

import { Modal } from '@/components/ui/Modal';
import { HiOutlineTrash } from 'react-icons/hi2';

const announcementSchema = z.object({
  title: z.string().min(2, 'En az 2 karakter olmalı'),
  body: z.string().min(2, 'En az 2 karakter olmalı'),
  active: z.boolean().optional(),
  eventTypeId: z.string().min(1, 'Etkinlik tipi seçiniz'),
  formUrl: z.string().url().optional().or(z.literal('')),
  coverImage: z
    .custom<File | undefined>((val) => val === undefined || val instanceof File)
    .optional(),
});

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isPending, startTransition] = useTransition();
  const [announcement, setAnnouncement] = useState<AnnouncementDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<{ value: string; label: string }[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      Promise.all([announcementsApi.getById(id, { includeEventType: true }), eventTypesApi.list()])
        .then(([announcementResponse, eventTypesResponse]) => {
          if (announcementResponse.success && announcementResponse.data) {
            setAnnouncement(announcementResponse.data);
            setIsActive(announcementResponse.data.active ?? true);
          } else {
            setError('Duyuru bulunamadı');
          }
          setEventTypes(
            eventTypesResponse.map((team) => ({
              value: team.team,
              label: team.displayName?.tr || team.team,
            })),
          );
          setLoading(false);
        })
        .catch((err) => {
          console.error('Announcement fetch error:', err);
          setError('Duyuru yüklenirken hata oluştu');
          setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (data: z.infer<typeof announcementSchema>) => {
    startTransition(async () => {
      try {
        await announcementsApi.update(id, {
          title: data.title,
          body: data.body,
          active: isActive,
          eventTypeId: data.eventTypeId,
          formUrl: data.formUrl || undefined,
        });
        router.push('/announcements');
      } catch (error) {
        console.error('Announcement update error:', error);
      }
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await announcementsApi.delete(id);
      if (response.success) {
        router.push('/announcements');
      } else {
        console.error('Delete failed:', response);
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="py-8 text-center">Yükleniyor...</div>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-red-800">Hata</h2>
          <p className="text-red-700">{error || 'Duyuru bulunamadı'}</p>
          <Button href="/announcements" variant="secondary" className="mt-4">
            Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duyuru Düzenle"
        description={announcement.title}
        actions={
          <div className="flex items-center gap-3">
            <Toggle checked={isActive} onChange={setIsActive} />
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center justify-center !border-0 !bg-transparent !px-3 !py-3 hover:!bg-transparent"
              aria-label="Duyuruyu sil"
            >
              <HiOutlineTrash className="text-danger h-5 w-5" />
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-3xl">
        <div className="bg-light border-dark-200 rounded-lg border p-4 shadow">
          <Form
            schema={announcementSchema}
            onSubmit={handleSubmit}
            defaultValues={{
              title: announcement.title,
              body: announcement.body,
              eventTypeId: announcement.eventType?.id || '',
              formUrl: announcement.formUrl || '',
              coverImage: undefined,
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
                        {Object.entries(formErrors).map(([key, error]) => (
                          <li key={key}>
                            {key}: {error?.message as string}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-dark-800 mb-3 text-sm font-semibold">Temel Bilgiler</h3>
                      <div className="space-y-4">
                        <TextField
                          name="title"
                          label="Başlık"
                          required
                          placeholder="Önemli Duyuru Başlığı"
                        />
                        <Textarea
                          name="body"
                          label="İçerik"
                          rows={6}
                          required
                          placeholder="Duyuru içeriği..."
                        />
                      </div>
                    </div>

                    <div className="border-dark-200 border-t pt-5">
                      <h3 className="text-dark-800 mb-3 text-sm font-semibold">Ek Bilgiler</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Select
                          name="eventTypeId"
                          label="Etkinlik Tipi"
                          options={eventTypes}
                          required
                        />
                        <TextField
                          name="formUrl"
                          label="Form URL"
                          type="url"
                          placeholder="https://forms.google.com/..."
                        />
                        <FileUpload name="coverImage" label="Kapak Resmi" accept="image/*" />
                      </div>
                    </div>
                  </div>
                  <FormActions
                    cancel={
                      <Button href="/announcements" variant="outlineDanger">
                        İptal
                      </Button>
                    }
                    submit={
                      <Button type="submit" variant="outlineBrand" disabled={isPending}>
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
        title="Duyuruyu Sil"
      >
        <p>
          <strong>{announcement.title}</strong> duyurusunu silmek istediğinizden emin misiniz? Bu
          işlem geri alınamaz.
        </p>
        <ModalDangerActions
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          isPending={isDeleting}
        />
      </Modal>
    </div>
  );
}
