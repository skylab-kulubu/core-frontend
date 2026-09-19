'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { HorizontalBars } from '@/components/chrome/PanelChart';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StateCard } from '@/components/chrome/StateCard';
import { UrlList } from '@/components/urls/UrlList';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { QrPreview } from '@/components/chrome/QrPreview';
import {
  hitUserLabel,
  publicShortUrl,
  shortQrFileName,
  shortQrPath,
  shortQrUrl,
  urlsApi,
  type ShortUrl,
  type ShortUrlHit,
} from '@/lib/api/urls';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { canModerateUrls, canUseUrls } from '@/lib/auth/groups';
import { listStatus } from '@/lib/list-status';
import { topClickUrls } from '@/lib/panel-charts';
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
  const [hitsRow, setHitsRow] = useState<ShortUrl | null>(null);
  const [hits, setHits] = useState<ShortUrlHit[]>([]);
  const [hitsError, setHitsError] = useState<string | null>(null);
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
        <StateCard
          title="Kısa URL yetkin yok"
          description="url:create veya moderasyon rolü gerekir."
          Icon={ShieldAlert}
          tone="warning"
        />
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
          <Field value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="opsiyonel" />
        </label>
        <SaveButton disabled={pending} className="self-end">
          {pending ? 'Kısaltılıyor…' : 'Kısalt'}
        </SaveButton>
      </form>
      {moderate ? (
        <HorizontalBars
          title="En çok tıklanan"
          data={topClickUrls(all.length ? all : mine)}
          empty="Tıklama verisi yok"
        />
      ) : null}
      <UrlList
        title="Linklerim"
        loading={loading}
        failed={Boolean(error)}
        items={mine}
        showClicks={moderate}
        onEdit={(row) => {
          setEditing(row);
          setEditTarget(row.url);
          setEditAlias(row.alias);
        }}
        onQr={setQrRow}
        onHits={
          moderate
            ? async (row) => {
                setHitsRow(row);
                setHitsError(null);
                try {
                  setHits(await urlsApi.listHits(row.id));
                } catch (err) {
                  setHits([]);
                  setHitsError(err instanceof ProblemError ? err.title : 'Tıklamalar yüklenemedi');
                }
              }
            : undefined
        }
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
          showClicks
          onEdit={(row) => {
            setEditing(row);
            setEditTarget(row.url);
            setEditAlias(row.alias);
          }}
          onQr={setQrRow}
          onHits={async (row) => {
            setHitsRow(row);
            setHitsError(null);
            try {
              setHits(await urlsApi.listHits(row.id));
            } catch (err) {
              setHits([]);
              setHitsError(err instanceof ProblemError ? err.title : 'Tıklamalar yüklenemedi');
            }
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
      <Drawer open={qrRow !== null} onClose={() => setQrRow(null)} title="QR">
        {qrRow ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400">{publicShortUrl(qrRow.alias)}</p>
            <QrPreview
              imageUrl={shortQrUrl(qrRow.alias)}
              downloadPath={shortQrPath(qrRow.alias, { size: 1024 })}
              fileName={shortQrFileName(qrRow.alias)}
              label={`QR ${qrRow.alias}`}
            />
          </div>
        ) : null}
      </Drawer>
      <Drawer open={hitsRow !== null} onClose={() => setHitsRow(null)} title="Tıklamalar">
        {hitsRow ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400">{publicShortUrl(hitsRow.alias)}</p>
            {hitsError ? <p className="text-sm text-red-300">{hitsError}</p> : null}
            <ListPanel
              status={listStatus({
                loading: false,
                failed: Boolean(hitsError),
                rowCount: hits.length,
                emptyMessage: 'Henüz tıklama yok.',
              })}
            >
              {hits.map((hit, index) => (
                <ListItem
                  key={`${hit.createdAt}-${hit.ip}-${index}`}
                  title={formatApplicantWhen(hit.createdAt)}
                  subtitle={`${hit.ip} · ${hit.userAgent} · ${hit.referer || '—'} · ${hitUserLabel(hit)}`}
                />
              ))}
            </ListPanel>
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
              <Field value={editAlias} onChange={(e) => setEditAlias(e.target.value)} required />
            </label>
            <SaveButton>Kaydet</SaveButton>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}
