'use client';

import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import type { UserCard } from '@/lib/api/identity';
import { listStatus } from '@/lib/list-status';

export function UserCardView({ card }: { card: UserCard }) {
  const name = `${card.firstName} ${card.lastName}`.trim();
  return (
    <div className="space-y-6">
      <PageHeader title={name || card.email} description={card.email} />
      {card.skyNumber ? (
        <p className="font-mono text-sm text-neutral-200">{card.skyNumber}</p>
      ) : null}
      {card.schoolEmail ? <p className="text-sm text-neutral-400">{card.schoolEmail}</p> : null}
      <section className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Gruplar</h2>
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: card.groups.length,
            emptyMessage: 'Grup yok',
          })}
        >
          {card.groups.map((g) => (
            <ListItem key={g.id} title={g.path} />
          ))}
        </ListPanel>
      </section>
      <section className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Miras client rolleri
        </h2>
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: card.inheritedRoles.length,
            emptyMessage: 'Miras rol yok',
          })}
        >
          {card.inheritedRoles.map((r) => (
            <ListItem key={`${r.clientId}:${r.role}`} title={r.role} subtitle={r.clientId} />
          ))}
        </ListPanel>
      </section>
      <section className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Ekstra client rolleri
        </h2>
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: card.extraRoles.length,
            emptyMessage: 'Ekstra rol yok',
          })}
        >
          {card.extraRoles.map((r) => (
            <ListItem key={`${r.clientId}:${r.role}`} title={r.role} subtitle={r.clientId} />
          ))}
        </ListPanel>
      </section>
    </div>
  );
}
