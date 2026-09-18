'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { mediaApi, type Media } from '@/lib/api/media';
import { listStatus } from '@/lib/list-status';
import { isPrivileged } from '@/lib/auth/groups';
import { useAuth } from '@/context/AuthContext';

export default function MediaPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medya"
        description="Yükleme R2’ye gider. URL’yi duyuru kapak görseli olarak yapıştırabilirsiniz."
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
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: items.length,
          emptyMessage: 'Henüz dosya yok.',
        })}
      >
        {items.map((row) => (
          <ListItem
            key={row.id}
            title={row.name}
            subtitle={`${row.kind} · ${row.url}`}
            trailing={
              privileged ? (
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
              ) : undefined
            }
          />
        ))}
      </ListPanel>
    </div>
  );
}
