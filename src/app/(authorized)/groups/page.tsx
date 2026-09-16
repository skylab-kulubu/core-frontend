'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { Field } from '@/components/chrome/Field';
import { identityApi, type Group } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';

const PAGE_SIZE = 10;

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    identityApi
      .listGroups()
      .then(setGroups)
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Gruplar yüklenemedi'));
  }, []);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return groups.slice(start, start + PAGE_SIZE);
  }, [groups, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gruplar"
        description="Keycloak grup ağacı. Client-role map grup kartında."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const created = await identityApi.createGroup({
            name: name.trim(),
            parentId: parentId || undefined,
          });
          setGroups((prev) => [...prev, created]);
          setName('');
          setParentId('');
        }}
      >
        <Field
          className="w-48"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Grup adı"
          required
        />
        <select
          className="h-8 rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">Kök</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.path}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
        >
          Oluştur
        </button>
      </form>
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {slice.map((g) => (
          <ListItem
            key={g.id}
            href={`/groups/${encodeURIComponent(g.id)}`}
            title={g.name}
            subtitle={g.path}
          />
        ))}
      </div>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
