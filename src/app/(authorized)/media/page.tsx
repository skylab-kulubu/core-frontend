'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2, Upload } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { mediaApi, type Media } from '@/lib/api/media';
import { publicMediaUrl } from '@/lib/event-media';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { isPrivileged } from '@/lib/auth/groups';
import { useAuth } from '@/context/AuthContext';

function isImage(row: Media) {
  return row.kind?.toLowerCase().includes('image') || row.type?.toLowerCase().startsWith('image/');
}

export default function MediaPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'image' | 'file'>('all');
  const [page, setPage] = useState(1);

  async function load() {
    try {
      setItems(await mediaApi.list());
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Medya yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (kind === 'image' && !isImage(row)) return false;
      if (kind === 'file' && isImage(row)) return false;
      return matchesQuery(query, row.name, row.kind, row.type);
    });
  }, [items, query, kind]);
  const paged = paginateRows(filtered, page);

  useEffect(() => {
    setPage(1);
  }, [query, kind]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medya"
        description="Dosya yükle. Duyuru kapağı için adresi kopyalayabilirsin."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setPending(true);
                try {
                  await mediaApi.upload(file);
                  await load();
                } catch (err) {
                  setError(err instanceof ProblemError ? err.title : 'Yüklenemedi');
                } finally {
                  setPending(false);
                }
              }}
            />
            <ActionButton
              icon={Upload}
              variant="primary"
              label={pending ? 'Yükleniyor…' : 'Yükle'}
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            />
          </>
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListToolbar query={query} onQuery={setQuery} placeholder="Dosya adı" searchLabel="Medya ara">
        <FilterPills
          ariaLabel="Medya türü"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'image', label: 'Görsel' },
            { value: 'file', label: 'Dosya' },
          ]}
        />
      </ListToolbar>
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Henüz dosya yok.',
            noneMatch: 'Eşleşen dosya yok.',
            query,
            filtered: kind !== 'all',
          }),
        })}
        emptyDescription="Yükle veya filtreyi temizle."
      >
        {paged.slice.map((row) => {
          const href = publicMediaUrl(row.url) || row.url;
          return (
            <ListItem
              key={row.id}
              title={row.name}
              subtitle={`${row.kind} · ${href}`}
              leading={
                isImage(row) && href ? (
                  <img
                    src={href}
                    alt=""
                    className="h-9 w-9 rounded-lg border border-white/10 object-cover"
                  />
                ) : undefined
              }
              trailing={
                <div className="flex items-center gap-1">
                  <StatusChip
                    kind="neutral"
                    label={isImage(row) ? 'Görsel' : row.kind || 'Dosya'}
                  />
                  {href ? (
                    <ActionButton
                      icon={Copy}
                      label="Adresi kopyala"
                      onClick={() => void navigator.clipboard.writeText(href)}
                    />
                  ) : null}
                  {privileged ? (
                    <ActionButton
                      icon={Trash2}
                      label="Sil"
                      onClick={async () => {
                        try {
                          await mediaApi.remove(row.id);
                          await load();
                        } catch (err) {
                          setError(err instanceof ProblemError ? err.title : 'Silinemedi');
                        }
                      }}
                    />
                  ) : null}
                </div>
              }
            />
          );
        })}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
    </div>
  );
}
