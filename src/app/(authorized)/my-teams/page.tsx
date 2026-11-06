'use client';

import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { listStatus } from '@/lib/list-status';
import { flattenManagedGroups, useManagedGroups } from '@/lib/managed-groups';

/**
 * Ekiplerim: the Teams the reader leads and the Teams below them (core's
 * managed tree, ekip-yetkileri ticket 08). A Team opens the Group page, where
 * core's `members.write` decides the add and remove buttons.
 */
export default function MyTeamsPage() {
  const managed = useManagedGroups();
  if (managed.status === 'loading') return <StateCard title="Yükleniyor…" isLoading />;
  const rows = managed.status === 'ready' ? flattenManagedGroups(managed.groups) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Ekiplerim" description="Lideri olduğun ekipler ve altlarındaki ekipler." />
      {managed.status === 'failed' ? (
        <p role="alert" className="text-destructive text-sm">
          Ekipler yüklenemedi
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading: false,
          failed: managed.status === 'failed',
          rowCount: rows.length,
          emptyMessage: 'Yönettiğin ekip yok',
        })}
      >
        {rows.map(({ group, depth }) => (
          <ListItem
            key={group.id}
            href={`/my-teams/${encodeURIComponent(group.id)}`}
            title={`${'— '.repeat(depth)}${group.displayName?.tr?.trim() || group.code}`}
            subtitle={
              group.memberCount === undefined
                ? group.path
                : `${group.path} · ${group.memberCount} üye`
            }
          />
        ))}
      </ListPanel>
    </div>
  );
}
