'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Pencil, QrCode, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ListPanel } from '@/components/chrome/ListPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { publicShortUrl, shortQrUrl, urlsApi, type ShortUrl } from '@/lib/api/urls';
import { canModerateUrls, canUseUrls } from '@/lib/auth/groups';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';

export default function UrlsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const roles = user?.roles ?? [];
  const allowed = canUseUrls(groups, roles);
  const moderate = canModerateUrls(groups, roles);
  const [mine, setMine] = useState<ShortUrl[]>([]);
  const [all, setAll] = useState<ShortUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [alias, setAlias] = useState('');
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<ShortUrl | null>(null);
  const [qrRow, setQrRow] = useState<ShortUrl | null>(null);
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
    } finally {
      setLoading(false);
    }
  }, [allowed, moderate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kısa URL" description="Bu ekran kısa link rolü ister." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kısa URL"
        description="Hedef adresi kısalt. İsteğe bağlı kısa ad verebilirsin."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <form
          className="flex flex-wrap items-end gap-2"
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
        <label className="block min-w-64 flex-1 space-y-1">
          <FieldLabel>Hedef adres</FieldLabel>
          <Field
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://…"
            required
          />
        </label>
        <label className="block w-40 space-y-1">
          <FieldLabel>Kısa ad</FieldLabel>
          <Field
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="opsiyonel"
          />
        </label>
        <SaveButton disabled={pending} className="self-end">
          {pending ? 'Kısaltılıyor…' : 'Kısalt'}
        </SaveButton>
      </form>
      <UrlList
        title="Linklerim"
        loading={loading}
        failed={Boolean(error)}
        items={mine}
        onEdit={(row) => {
          setEditing(row);
          setEditTarget(row.url);
          setEditAlias(row.alias);
        }}
        onQr={setQrRow}
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
          loading={loading}
          failed={Boolean(error)}
          items={all}
          onEdit={(row) => {
            setEditing(row);
            setEditTarget(row.url);
            setEditAlias(row.alias);
          }}
          onQr={setQrRow}
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
      <Drawer open={qrRow !== null} onClose={() => setQrRow(null)} title="QR">
        {qrRow ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400">{publicShortUrl(qrRow.alias)}</p>
            <object
              data={shortQrUrl(qrRow.alias)}
              type="image/png"
              className="h-48 w-48 rounded-md bg-white"
              aria-label={`QR ${qrRow.alias}`}
            />
          </div>
        ) : null}
      </Drawer>
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
            <label className="block space-y-1">
              <FieldLabel>Hedef adres</FieldLabel>
              <Field
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                placeholder="https://…"
                required
              />
            </label>
            <label className="block space-y-1">
              <FieldLabel>Kısa ad</FieldLabel>
              <Field
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                required
              />
            </label>
            <SaveButton>Kaydet</SaveButton>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}

function UrlList({
  title,
  items,
  loading,
  failed,
  onEdit,
  onQr,
  onDelete,
}: {
  title: string;
  items: ShortUrl[];
  loading: boolean;
  failed: boolean;
  onEdit: (row: ShortUrl) => void;
  onQr: (row: ShortUrl) => void;
  onDelete: (row: ShortUrl) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-neutral-300">{title}</h2>
      <ListPanel
        status={listStatus({
          loading,
          failed,
          rowCount: items.length,
          emptyMessage: 'Henüz kısa URL yok.',
        })}
      >
        {items.map((row) => {
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
                  <ActionButton icon={QrCode} label="QR" onClick={() => onQr(row)} />
                  <ActionButton icon={Pencil} label="Düzenle" onClick={() => onEdit(row)} />
                  <ActionButton icon={Trash2} label="Sil" onClick={() => onDelete(row)} />
                </>
              }
            />
          );
        })}
      </ListPanel>
    </section>
  );
}
