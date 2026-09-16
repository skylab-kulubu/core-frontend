'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { publicShortUrl, urlsApi, type ShortUrl } from '@/lib/api/urls';
import { canModerateUrls, canUseUrls } from '@/lib/auth/groups';
import { useAuth } from '@/context/AuthContext';

export default function UrlsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const roles = user?.roles ?? [];
  const allowed = canUseUrls(groups, roles);
  const moderate = canModerateUrls(groups, roles);
  const [mine, setMine] = useState<ShortUrl[]>([]);
  const [all, setAll] = useState<ShortUrl[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [alias, setAlias] = useState('');
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<ShortUrl | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [editAlias, setEditAlias] = useState('');

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const mineRows = await urlsApi.listMine();
      setMine(mineRows);
      if (moderate) {
        setAll(await urlsApi.listAll());
      } else {
        setAll([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'URL’ler yüklenemedi');
    }
  }, [allowed, moderate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kısa URL" description="Bu ekran url veya skylapp client rolü ister." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kısa URL"
        description="skyl.app/{alias} Traefik üzerinden Go core’a 301 gider."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!target.trim()) return;
          setPending(true);
          try {
            await urlsApi.create({
              url: target.trim(),
              alias: alias.trim() || undefined,
            });
            setTarget('');
            setAlias('');
            await load();
          } catch (err) {
            setError(err instanceof ProblemError ? err.title : 'Kısaltılamadı');
          } finally {
            setPending(false);
          }
        }}
      >
        <Field
          className="min-w-64 flex-1"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="https://…"
          required
        />
        <Field
          className="w-40"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="alias (opsiyonel)"
        />
        <button
          type="submit"
          disabled={pending}
          className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium disabled:opacity-60"
        >
          {pending ? 'Kısaltılıyor…' : 'Kısalt'}
        </button>
      </form>
      <UrlList
        title="Linklerim"
        items={mine}
        onEdit={(row) => {
          setEditing(row);
          setEditTarget(row.url);
          setEditAlias(row.alias);
        }}
        onDelete={async (row) => {
          try {
            await urlsApi.remove(row.id);
            await load();
          } catch (err) {
            setError(err instanceof ProblemError ? err.title : 'Silinemedi');
          }
        }}
      />
      {moderate ? (
        <UrlList
          title="Tümü"
          items={all}
          onEdit={(row) => {
            setEditing(row);
            setEditTarget(row.url);
            setEditAlias(row.alias);
          }}
          onDelete={async (row) => {
            try {
              await urlsApi.remove(row.id);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Silinemedi');
            }
          }}
        />
      ) : null}
      <Drawer open={editing !== null} onClose={() => setEditing(null)} title="Kısa URL düzenle">
        {editing ? (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await urlsApi.update(editing.id, {
                  url: editTarget.trim(),
                  alias: editAlias.trim(),
                });
                setEditing(null);
                await load();
              } catch (err) {
                setError(err instanceof ProblemError ? err.title : 'Güncellenemedi');
              }
            }}
          >
            <Field
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              placeholder="https://…"
              required
            />
            <Field
              value={editAlias}
              onChange={(e) => setEditAlias(e.target.value)}
              placeholder="alias"
              required
            />
            <button
              type="submit"
              className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
            >
              Kaydet
            </button>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function UrlList({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  items: ShortUrl[];
  onEdit: (row: ShortUrl) => void;
  onDelete: (row: ShortUrl) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-neutral-300">{title}</h2>
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {items.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-neutral-500">Henüz kısa URL yok.</p>
        ) : (
          items.map((row) => {
            const short = publicShortUrl(row.alias);
            return (
              <ListItem
                key={row.id}
                title={short}
                subtitle={`${row.url} · ${row.clickCount} tıklama`}
                trailing={
                  <>
                    <ActionButton
                      icon={Copy}
                      label="Kopyala"
                      onClick={() => void navigator.clipboard.writeText(short)}
                    />
                    <ActionButton icon={Pencil} label="Düzenle" onClick={() => onEdit(row)} />
                    <ActionButton icon={Trash2} label="Sil" onClick={() => onDelete(row)} />
                  </>
                }
              />
            );
          })
        )}
      </div>
    </section>
  );
}
