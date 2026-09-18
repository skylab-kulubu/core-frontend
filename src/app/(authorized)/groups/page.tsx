'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Pagination } from '@/components/chrome/Pagination';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { identityApi, type Group } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';
import { emptyListCopy, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { pickerMatch } from '@/lib/picker';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [parentOpen, setParentOpen] = useState(false);
  const [parentQuery, setParentQuery] = useState('');

  useEffect(() => {
    identityApi
      .listGroups()
      .then(setGroups)
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Gruplar yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => groups.filter((g) => pickerMatch(query, g.name, g.path)),
    [groups, query],
  );
  const paged = paginateRows(filtered, page);
  const parent = groups.find((g) => g.id === parentId);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gruplar"
        description="Ekipler, kurullar ve üye ağacı. Site görünürlüğü grup kartında."
        actions={
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Grup ekle"
            onClick={() => setCreating(true)}
          />
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Ad veya yol"
        searchLabel="Grup ara"
      />
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Grup yok',
            noneMatch: 'Eşleşen grup yok',
            query,
          }),
        })}
        emptyDescription="Yeni grup ekle veya aramayı temizle."
      >
        {paged.slice.map((g) => (
          <ListItem
            key={g.id}
            href={`/groups/${encodeURIComponent(g.id)}`}
            title={g.name}
            subtitle={g.path}
          />
        ))}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
      <Drawer open={creating} onClose={() => setCreating(false)} title="Grup ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            try {
              const created = await identityApi.createGroup({
                name: name.trim(),
                parentId: parentId || undefined,
              });
              setGroups((prev) => [...prev, created]);
              setName('');
              setParentId('');
              setCreating(false);
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
            }
          }}
        >
          <label className="block space-y-1">
            <FieldLabel>Ad</FieldLabel>
            <Field value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Üst grup</FieldLabel>
            <button
              type="button"
              className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-left text-xs text-neutral-100"
              onClick={() => {
                setParentQuery('');
                setParentOpen(true);
              }}
            >
              {parent ? parent.path : 'Kök'}
            </button>
          </label>
          <SaveButton>Oluştur</SaveButton>
        </form>
      </Drawer>
      <PickerDrawer
        open={parentOpen}
        onClose={() => setParentOpen(false)}
        title="Üst grup"
        query={parentQuery}
        onQuery={setParentQuery}
        placeholder="Grup yolu veya adı"
        loading={false}
        options={[
          { id: '', title: 'Kök' },
          ...groups
            .filter((g) => pickerMatch(parentQuery, g.path, g.name))
            .map((g) => ({ id: g.id, title: g.path, subtitle: g.name })),
        ]}
        emptyMessage="Grup yok"
        onPick={(picked) => {
          setParentId(picked);
          setParentOpen(false);
        }}
      />
    </div>
  );
}
