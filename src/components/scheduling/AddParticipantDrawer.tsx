'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { PersonPick } from '@/components/identity/PersonPick';
import { ProblemError } from '@/lib/api/core';
import { ticketsApi, type GuestApplyBody, type Ticket } from '@/lib/api/tickets';

const memberSchema = z.object({
  personId: z.string().trim().min(1, 'Kişi seçin'),
});

const guestSchema = z.object({
  firstName: z.string().trim().min(1, 'Ad zorunlu'),
  lastName: z.string().trim().min(1, 'Soyad zorunlu'),
  email: z.string().trim().email('Geçerli bir e-posta girin'),
  phone: z.string().trim(),
});

type MemberForm = z.infer<typeof memberSchema>;
type GuestForm = z.infer<typeof guestSchema>;

export function AddParticipantDrawer({
  open,
  onClose,
  eventId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onCreated: (ticket: Ticket) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const memberForm = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: { personId: '' },
  });
  const guestForm = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  });
  const personId = memberForm.watch('personId');
  const pending = memberForm.formState.isSubmitting || guestForm.formState.isSubmitting;

  function reset() {
    memberForm.reset();
    guestForm.reset();
    setError(null);
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Katılımcı ekle"
    >
      <div className="space-y-6">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <form
          className="space-y-3"
          noValidate
          onSubmit={memberForm.handleSubmit(async ({ personId: selectedPersonId }) => {
            setError(null);
            try {
              const ticket = await ticketsApi.applyForOther(eventId, selectedPersonId);
              reset();
              onCreated(ticket);
              onClose();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Üye kaydı yazılamadı');
            }
          })}
        >
          <PersonPick
            valueId={personId}
            onChange={(value) => memberForm.setValue('personId', value, { shouldValidate: true })}
            searchPeople={(query) => ticketsApi.listAssignableUsers(eventId, query)}
          />
          {memberForm.formState.errors.personId ? (
            <p className="text-2xs text-red-300">{memberForm.formState.errors.personId.message}</p>
          ) : null}
          <SaveButton disabled={pending || !personId}>
            {memberForm.formState.isSubmitting ? 'Yazılıyor…' : 'Üye kaydı yaz'}
          </SaveButton>
        </form>
        <form
          className="space-y-3"
          noValidate
          onSubmit={guestForm.handleSubmit(async (guest) => {
            setError(null);
            try {
              const body: GuestApplyBody = {
                firstName: guest.firstName,
                lastName: guest.lastName,
                email: guest.email,
              };
              if (guest.phone) body.phoneNumber = guest.phone;
              const ticket = await ticketsApi.applyGuest(eventId, body);
              reset();
              onCreated(ticket);
              onClose();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Misafir kaydı yazılamadı');
            }
          })}
        >
          <label className="block space-y-1">
            <FieldLabel>Ad</FieldLabel>
            <Field
              {...guestForm.register('firstName')}
              aria-invalid={Boolean(guestForm.formState.errors.firstName)}
            />
            {guestForm.formState.errors.firstName ? (
              <span className="text-2xs text-red-300">
                {guestForm.formState.errors.firstName.message}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>Soyad</FieldLabel>
            <Field
              {...guestForm.register('lastName')}
              aria-invalid={Boolean(guestForm.formState.errors.lastName)}
            />
            {guestForm.formState.errors.lastName ? (
              <span className="text-2xs text-red-300">
                {guestForm.formState.errors.lastName.message}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>E-posta</FieldLabel>
            <Field
              type="email"
              {...guestForm.register('email')}
              aria-invalid={Boolean(guestForm.formState.errors.email)}
            />
            {guestForm.formState.errors.email ? (
              <span className="text-2xs text-red-300">
                {guestForm.formState.errors.email.message}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <FieldLabel>Telefon</FieldLabel>
            <Field {...guestForm.register('phone')} />
          </label>
          <SaveButton disabled={pending}>
            {guestForm.formState.isSubmitting ? 'Yazılıyor…' : 'Misafir kaydı yaz'}
          </SaveButton>
        </form>
      </div>
    </Drawer>
  );
}
