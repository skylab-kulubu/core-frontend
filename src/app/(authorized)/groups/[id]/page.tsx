'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { identityApi, type ClientRole, type Group, type Person } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [users, setUsers] = useState<Person[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [clientId, setClientId] = useState('skyforms');
  const [role, setRole] = useState('');
  const [memberId, setMemberId] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [rename, setRename] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [g, mem, mapped, all] = await Promise.all([
        identityApi.getGroup(id),
        identityApi.members(id),
        identityApi.groupRoles(id),
        identityApi.listUsers(),
      ]);
      setGroup(g);
      setMembers(mem);
      setRoles(mapped);
      setUsers(all);
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const notMembers = users.filter((u) => !members.some((m) => m.id === u.id));
  const attrs = group?.attributes ?? {};

  return (
    <div className="space-y-6">
      <PageHeader title={group?.name ?? id} description={group?.path} />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!rename.trim()) return;
          await identityApi.updateGroup(id, { name: rename.trim() });
          setRename('');
          await load();
        }}
      >
        <Field
          className="w-48"
          value={rename}
          onChange={(e) => setRename(e.target.value)}
          placeholder="Yeni ad"
          required
        />
        <button
          type="submit"
          className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
        >
          Yeniden adlandır
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Üyeler</h2>
        <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
          {members.map((m) => (
            <ListItem
              key={m.id}
              href={`/users/${m.id}`}
              title={`${m.firstName} ${m.lastName}`.trim() || m.email}
              subtitle={m.email}
              trailing={
                <ActionButton
                  icon={X}
                  label="Çıkar"
                  onClick={async () => {
                    await identityApi.removeMember(id, m.id);
                    await load();
                  }}
                />
              }
            />
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!memberId) return;
            await identityApi.addMember(id, memberId);
            setMemberId('');
            await load();
          }}
        >
          <select
            className="h-8 rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">Üye ekle</option>
            {notMembers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
          >
            Ekle
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          Group → client-role
        </h2>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
          {roles.map((r) => (
            <li
              key={`${r.clientId}:${r.role}`}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-sm text-neutral-300">
                {r.clientId} {r.role}
              </span>
              <ActionButton
                icon={X}
                label="Kaldır"
                onClick={async () => {
                  await identityApi.setGroupRoles(
                    id,
                    roles.filter((x) => x.clientId !== r.clientId || x.role !== r.role),
                  );
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
            await identityApi.setGroupRoles(id, [...roles, { clientId, role }]);
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

      <section className="space-y-3">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Öznitelikler</h2>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
          {Object.entries(attrs).map(([k, v]) => (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2 text-sm text-neutral-300"
            >
              <span>
                <span className="text-neutral-500">{k}</span> {v}
              </span>
              <ActionButton
                icon={X}
                label="Kaldır"
                onClick={async () => {
                  const next = { ...attrs };
                  delete next[k];
                  await identityApi.updateGroup(id, { attributes: next });
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
            if (!attrKey) return;
            await identityApi.updateGroup(id, { attributes: { ...attrs, [attrKey]: attrValue } });
            setAttrKey('');
            setAttrValue('');
            await load();
          }}
        >
          <Field
            className="w-40"
            value={attrKey}
            onChange={(e) => setAttrKey(e.target.value)}
            placeholder="key"
          />
          <Field
            className="w-40"
            value={attrValue}
            onChange={(e) => setAttrValue(e.target.value)}
            placeholder="value"
          />
          <button
            type="submit"
            className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
          >
            Kaydet
          </button>
        </form>
      </section>
    </div>
  );
}
