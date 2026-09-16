'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import type { UserCard } from '@/lib/api/identity';

export function UserCardView({ card }: { card: UserCard }) {
  const name = `${card.firstName} ${card.lastName}`.trim();
  return (
    <div className="space-y-6">
      <PageHeader title={name || card.email} description={card.email} />
      <section className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Gruplar</h2>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
          {card.groups.map((g) => (
            <li key={g.id} className="px-3 py-2 text-sm text-neutral-200">
              {g.path}
            </li>
          ))}
          {card.groups.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-600">Yok</li>
          ) : null}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Miras client rolleri
        </h2>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
          {card.inheritedRoles.map((r) => (
            <li key={`${r.clientId}:${r.role}`} className="px-3 py-2 text-sm text-neutral-300">
              <span className="text-neutral-500">{r.clientId}</span> {r.role}
            </li>
          ))}
          {card.inheritedRoles.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-600">Yok</li>
          ) : null}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Ekstra client rolleri
        </h2>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
          {card.extraRoles.map((r) => (
            <li key={`${r.clientId}:${r.role}`} className="text-skylab-300 px-3 py-2 text-sm">
              <span className="text-neutral-500">{r.clientId}</span> {r.role}
            </li>
          ))}
          {card.extraRoles.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-600">Yok</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
