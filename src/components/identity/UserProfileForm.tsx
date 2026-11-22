'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import type { UserCard, UserProfilePatch } from '@/lib/api/identity';

const profileSchema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  university: z.string().trim(),
  faculty: z.string().trim(),
  department: z.string().trim(),
  linkedin: z.string().trim(),
  phone: z.string().trim(),
});

type ProfileForm = z.infer<typeof profileSchema>;

/** The editable part of a person card; the phone goes out only when the card had one or it was typed. */
export function UserProfileForm({
  card,
  onSave,
  className = 'grid max-w-md gap-3',
  error,
  children,
}: {
  card: UserCard;
  onSave?: (patch: UserProfilePatch) => unknown;
  /** Why the last save was refused, said beside Kaydet. */
  error?: string | null;
  className?: string;
  /** Beside the save button, such as Vazgeç. */
  children?: React.ReactNode;
}) {
  const profileDefaults = {
    firstName: card.firstName ?? '',
    lastName: card.lastName ?? '',
    university: card.university ?? '',
    faculty: card.faculty ?? '',
    department: card.department ?? '',
    linkedin: card.linkedin ?? '',
    phone: card.phone ?? '',
  };
  const {
    register,
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaults,
  });

  useEffect(() => {
    reset(profileDefaults);
  }, [card, reset]);

  return (
    <form
      className={className}
      noValidate
      onSubmit={handleSubmit(async (profile) => {
        const patch: UserProfilePatch = {
          firstName: profile.firstName,
          lastName: profile.lastName,
          university: profile.university,
          faculty: profile.faculty,
          department: profile.department,
          linkedin: profile.linkedin,
        };
        if (card.phone !== undefined || profile.phone.trim() !== '') {
          patch.phone = profile.phone;
        }
        await onSave?.(patch);
      })}
    >
      <label className="block space-y-1">
        <FieldLabel>Ad</FieldLabel>
        <Field {...register('firstName')} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Soyad</FieldLabel>
        <Field {...register('lastName')} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Üniversite</FieldLabel>
        <Field {...register('university')} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Fakülte</FieldLabel>
        <Field {...register('faculty')} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Bölüm</FieldLabel>
        <Field {...register('department')} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>LinkedIn</FieldLabel>
        <Field {...register('linkedin')} />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Telefon</FieldLabel>
        <Field {...register('phone')} />
      </label>
      {card.studentCardUid ? (
        <label className="block space-y-1">
          <FieldLabel>Öğrenci kartı UID</FieldLabel>
          <Field value={card.studentCardUid} readOnly />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton disabled={isSubmitting}>
            {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
          </SaveButton>
          {children}
        </div>
      ) : (
        <SaveButton disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</SaveButton>
      )}
    </form>
  );
}
