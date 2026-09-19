'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ClientRole, UserCard, UserProfilePatch } from '@/lib/api/identity';
import { listStatus } from '@/lib/list-status';
import { roleKey } from '@/lib/picker';

function dash(value: string | undefined): string {
  const text = (value ?? '').trim();
  return text || '—';
}

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

export function UserCardView({
  card,
  canEditProfile,
  onSaveProfile,
  onAddGroup,
  onAddRole,
  onRemoveRole,
}: {
  card: UserCard;
  canEditProfile?: boolean;
  onSaveProfile?: (patch: UserProfilePatch) => void | Promise<void>;
  onAddGroup?: () => void;
  onAddRole?: () => void;
  onRemoveRole?: (role: ClientRole) => void;
}) {
  const groups = card.groups ?? [];
  const inheritedRoles = card.inheritedRoles ?? [];
  const extraRoles = card.extraRoles ?? [];
  const name = `${card.firstName ?? ''} ${card.lastName ?? ''}`.trim();
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
    <div className="space-y-6">
      <PageHeader
        title={name || card.email}
        description={card.email}
        meta={
          <>
            {card.skyNumber ? <StatusChip kind="member" label={card.skyNumber} /> : null}
            {card.schoolEmail ? <StatusChip kind="neutral" label={card.schoolEmail} /> : null}
          </>
        }
      />
      <section className="space-y-3">
        <SectionHeading title="Profil" />
        {canEditProfile ? (
          <form
            className="grid max-w-md gap-3"
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
              await onSaveProfile?.(patch);
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
            <SaveButton disabled={isSubmitting}>
              {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
            </SaveButton>
          </form>
        ) : (
          <dl className="grid max-w-md gap-3">
            <div className="space-y-1">
              <FieldLabel>Üniversite</FieldLabel>
              <p className="text-sm text-neutral-200">{dash(card.university)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>Fakülte</FieldLabel>
              <p className="text-sm text-neutral-200">{dash(card.faculty)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>Bölüm</FieldLabel>
              <p className="text-sm text-neutral-200">{dash(card.department)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>LinkedIn</FieldLabel>
              <p className="text-sm text-neutral-200">{dash(card.linkedin)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>Telefon</FieldLabel>
              <p className="text-sm text-neutral-200">{dash(card.phone)}</p>
            </div>
            {card.studentCardUid ? (
              <div className="space-y-1">
                <FieldLabel>Öğrenci kartı UID</FieldLabel>
                <p className="text-sm text-neutral-200">{card.studentCardUid}</p>
              </div>
            ) : null}
          </dl>
        )}
      </section>
      <section className="space-y-2">
        <SectionHeading
          title="Gruplar"
          meta={`${groups.length} grup`}
          actions={
            onAddGroup ? (
              <ActionButton icon={Plus} variant="primary" label="Grup ekle" onClick={onAddGroup} />
            ) : null
          }
        />
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: groups.length,
            emptyMessage: 'Grup yok',
          })}
        >
          {groups.map((g) => (
            <ListItem key={g.id} href={`/groups/${encodeURIComponent(g.id)}`} title={g.path} />
          ))}
        </ListPanel>
      </section>
      <section className="space-y-2">
        <SectionHeading title="Gruptan gelen roller" meta={`${inheritedRoles.length} rol`} />
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: inheritedRoles.length,
            emptyMessage: 'Miras rol yok',
          })}
        >
          {inheritedRoles.map((r) => (
            <ListItem key={roleKey(r)} title={r.role} subtitle={r.clientId} />
          ))}
        </ListPanel>
      </section>
      <section className="space-y-2">
        <SectionHeading
          title="Ekstra roller"
          meta={`${extraRoles.length} rol`}
          actions={
            onAddRole ? (
              <ActionButton icon={Plus} variant="primary" label="Rol ekle" onClick={onAddRole} />
            ) : null
          }
        />
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: extraRoles.length,
            emptyMessage: 'Ekstra rol yok',
          })}
        >
          {extraRoles.map((r) => (
            <ListItem
              key={roleKey(r)}
              title={r.role}
              subtitle={r.clientId}
              trailing={
                onRemoveRole ? (
                  <ActionButton icon={X} label="Kaldır" onClick={() => onRemoveRole(r)} />
                ) : null
              }
            />
          ))}
        </ListPanel>
      </section>
    </div>
  );
}
