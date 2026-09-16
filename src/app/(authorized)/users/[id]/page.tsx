'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { UserCardView } from '@/components/identity/UserCardView';
import { identityApi, type ClientRole, type UserCard } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const [card, setCard] = useState<UserCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('skyforms');
  const [role, setRole] = useState('');

  async function load() {
    try {
      setCard(await identityApi.getUser(params.id));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!card) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <UserCardView card={card} />
      <section className="space-y-3">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Ekstra rol ekle / çıkar
        </h2>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
          {card.extraRoles.map((r) => (
            <li
              key={`${r.clientId}:${r.role}`}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-skylab-300 text-sm">
                <span className="text-neutral-500">{r.clientId}</span> {r.role}
              </span>
              <ActionButton
                icon={X}
                label="Kaldır"
                onClick={async () => {
                  await identityApi.removeExtraRole(card.id, r);
                  await load();
                }}
              />
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const next: ClientRole = { clientId, role };
            await identityApi.addExtraRole(card.id, next);
            setRole('');
            await load();
          }}
        >
          <Field
            className="w-36"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="clientId"
          />
          <Field
            className="w-48"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="role"
            required
          />
          <button
            type="submit"
            className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
          >
            Ekle
          </button>
        </form>
      </section>
    </div>
  );
}
