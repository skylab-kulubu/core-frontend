'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/PageHeader';
import { Form } from '@/components/forms/Form';
import { TextField } from '@/components/forms/TextField';
import { Textarea } from '@/components/forms/Textarea';
import { Select } from '@/components/forms/Select';
import { FileUpload } from '@/components/forms/FileUpload';
import { Checkbox } from '@/components/forms/Checkbox';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { z } from 'zod';
import { announcementsApi } from '@/lib/api/announcements';
import { eventTypesApi } from '@/lib/api/event-types';

const announcementSchema = z.object({
  title: z.string().min(2, 'En az 2 karakter olmalı'),
  body: z.string().min(2, 'En az 2 karakter olmalı'),
  active: z.boolean().default(true),
  eventTypeId: z.string().min(1, 'Etkinlik tipi seçiniz'),
  formUrl: z.string().url().optional().or(z.literal('')),
  coverImage: z
    .custom<File | undefined>((val) => val === undefined || val instanceof File)
    .optional(),
});

export default function NewAnnouncementPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [eventTypes, setEventTypes] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    eventTypesApi
      .list()
      .then((teams) => {
        setEventTypes(
          teams.map((team) => ({
            value: team.team,
            label: team.displayName?.tr || team.team,
          })),
        );
      })
      .catch((error) => {
        console.error('Event types fetch error:', error);
      });
  }, []);

  const handleSubmit = async (data: z.infer<typeof announcementSchema>) => {
    startTransition(async () => {
      try {
        const announcementData = {
          title: data.title,
          body: data.body,
          active: data.active,
          eventTypeId: data.eventTypeId,
          formUrl: data.formUrl || undefined,
        };

        // Backend expects 'data' as a JSON string and 'coverImage' as a file in multipart/form-data
        // The api client handles the FormData creation, we just pass the object and file
        await announcementsApi.create(announcementData, data.coverImage);

        router.push('/announcements');
      } catch (error) {
        console.error('Announcement creation error:', error);
        alert(
          'Duyuru oluşturulurken hata oluştu: ' +
            (error instanceof Error ? error.message : 'Bilinmeyen hata'),
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni Duyuru" />

      <div className="mx-auto max-w-3xl">
        <div className="bg-light border-dark-200 rounded-lg border p-4 shadow">
          <Form
            schema={announcementSchema}
            onSubmit={handleSubmit}
            defaultValues={{ eventTypeId: '' }}
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
                        <div className="flex items-center pt-6">
                          <Checkbox name="active" label="Aktif mi?" />
                        </div>
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
