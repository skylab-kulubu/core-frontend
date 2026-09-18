'use client';

import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ClientRole, UserCard } from '@/lib/api/identity';
import { listStatus } from '@/lib/list-status';
import { roleKey } from '@/lib/picker';

export function UserCardView({
  card,
  onAddGroup,
  onAddRole,
  onRemoveRole,
}: {
  card: UserCard;
  onAddGroup?: () => void;
  onAddRole?: () => void;
  onRemoveRole?: (role: ClientRole) => void;
}) {
  const name = `${card.firstName} ${card.lastName}`.trim();
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
      <section className="space-y-2">
        <SectionHeading
          title="Gruplar"
          meta={`${card.groups.length} grup`}
          actions={
            onAddGroup ? (
              <ActionButton icon={Plus} variant="primary" label="Grup ekle" onClick={onAddGroup} />
            ) : null
          }
        />
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: card.groups.length,
            emptyMessage: 'Grup yok',
          })}
        >
          {card.groups.map((g) => (
            <ListItem key={g.id} href={`/groups/${encodeURIComponent(g.id)}`} title={g.path} />
          ))}
        </ListPanel>
      </section>
      <section className="space-y-2">
        <SectionHeading title="Gruptan gelen roller" meta={`${card.inheritedRoles.length} rol`} />
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: card.inheritedRoles.length,
            emptyMessage: 'Miras rol yok',
          })}
        >
          {card.inheritedRoles.map((r) => (
            <ListItem key={roleKey(r)} title={r.role} subtitle={r.clientId} />
          ))}
        </ListPanel>
      </section>
      <section className="space-y-2">
        <SectionHeading
          title="Ekstra roller"
          meta={`${card.extraRoles.length} rol`}
          actions={
            onAddRole ? (
              <ActionButton icon={Plus} variant="primary" label="Rol ekle" onClick={onAddRole} />
            ) : null
          }
        />
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: card.extraRoles.length,
            emptyMessage: 'Ekstra rol yok',
          })}
        >
          {card.extraRoles.map((r) => (
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
