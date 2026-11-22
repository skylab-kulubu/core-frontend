'use client';

import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { UserProfileForm } from './UserProfileForm';
import type { ClientRole, UserCard, UserProfilePatch } from '@/lib/api/identity';
import { listStatus } from '@/lib/list-status';
import { roleKey } from '@/lib/picker';

function dash(value: string | undefined): string {
  const text = (value ?? '').trim();
  return text || '—';
}

export function UserCardView({
  card,
  canEditProfile,
  canReadFull,
  onSaveProfile,
  onAddGroup,
  onRemoveRole,
}: {
  card: UserCard;
  canEditProfile?: boolean;
  /** core's `user.readFull`: the card carries the phone and the student card UID. */
  canReadFull?: boolean;
  onSaveProfile?: (patch: UserProfilePatch) => void | Promise<void>;
  onAddGroup?: () => void;
  onRemoveRole?: (role: ClientRole) => void;
}) {
  const groups = card.groups ?? [];
  const inheritedRoles = card.inheritedRoles ?? [];
  const extraRoles = card.extraRoles ?? [];
  const name = `${card.firstName ?? ''} ${card.lastName ?? ''}`.trim();
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
          <UserProfileForm card={card} onSave={onSaveProfile} />
        ) : (
          <dl className="grid max-w-md gap-3">
            <div className="space-y-1">
              <FieldLabel>Üniversite</FieldLabel>
              <p className="text-secondary-foreground text-sm">{dash(card.university)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>Fakülte</FieldLabel>
              <p className="text-secondary-foreground text-sm">{dash(card.faculty)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>Bölüm</FieldLabel>
              <p className="text-secondary-foreground text-sm">{dash(card.department)}</p>
            </div>
            <div className="space-y-1">
              <FieldLabel>LinkedIn</FieldLabel>
              <p className="text-secondary-foreground text-sm">{dash(card.linkedin)}</p>
            </div>
            {canReadFull ? (
              <div className="space-y-1">
                <FieldLabel>Telefon</FieldLabel>
                <p className="text-secondary-foreground text-sm">{dash(card.phone)}</p>
              </div>
            ) : null}
            {card.studentCardUid ? (
              <div className="space-y-1">
                <FieldLabel>Öğrenci kartı UID</FieldLabel>
                <p className="text-secondary-foreground text-sm">{card.studentCardUid}</p>
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
        <SectionHeading title="Doğrudan roller" meta={`${extraRoles.length} rol`} />
        <p className="text-3xs text-subtle-foreground">
          Yetkiler rol grupları ve ekip grupları üzerinden verilir; kişiye doğrudan rol verilmez. Bu
          roller bir gruptan verilmeli: kişiyi rolü taşıyan gruba (ör. /ROLLER altındaki rol grubu)
          ekle, sonra buradan kaldır.
        </p>
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: extraRoles.length,
            emptyMessage: 'Doğrudan rol yok',
          })}
        >
          {extraRoles.map((r) => (
            <ListItem
              key={roleKey(r)}
              title={r.role}
              subtitle={r.clientId}
              trailing={
                <span className="flex items-center gap-2">
                  <StatusChip kind="pending" label="Taşınacak" />
                  {onRemoveRole ? (
                    <ActionButton icon={X} label="Kaldır" onClick={() => onRemoveRole(r)} />
                  ) : null}
                </span>
              }
            />
          ))}
        </ListPanel>
      </section>
    </div>
  );
}
