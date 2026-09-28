'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { FilterPills } from '@/components/chrome/ListToolbar';
import { HorizontalBars } from '@/components/chrome/PanelChart';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StateCard } from '@/components/chrome/StateCard';
import { AliasHint, useAliasHint } from '@/components/urls/AliasHint';
import { UrlList } from '@/components/urls/UrlList';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { QrPreview } from '@/components/chrome/QrPreview';
import {
  asHitList,
  hitChannel,
  hitUserLabel,
  hitWhen,
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
import {
  isManagedRefusal,
  managedRefusalMessage,
  SOURCE_FILTERS,
  type SourceFilter,
} from '@/lib/short-links';
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
  const [source, setSource] = useState<SourceFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const aliasHint = useAliasHint(alias, 'create');
  const editAliasHint = useAliasHint(editing ? editAlias : '', 'edit', editing?.alias);
  // Only the latest load may fill the lists, so a slow answer for an older filter is dropped
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!allowed) return;
    const seq = ++loadSeq.current;
    try {
      const mineRows = await urlsApi.listMine(source);
      if (seq !== loadSeq.current) return;
      setMine(mineRows);
      if (moderate) {
        const allRows = await urlsApi.listAll(source);
        if (seq !== loadSeq.current) return;
        setAll(allRows);
      } else {
        setAll([]);
      }
      setError(null);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof ProblemError ? err.title : 'URL’ler yüklenemedi');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [allowed, moderate, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeRow = async (row: ShortUrl) => {
    setNotice(null);
    try {
      await urlsApi.remove(row.id);
      await load();
    } catch (err) {
      if (isManagedRefusal(err)) {
        setNotice(managedRefusalMessage(row));
        await load();
        return;
      }
      setError(err instanceof ProblemError ? err.title : 'Silinemedi');
    }
  };

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
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {notice ? <p className="text-warning text-sm">{notice}</p> : null}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!target.trim() || aliasHint?.blocks) return;
          setNotice(null);
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
            aria-describedby="alias-hint"
          />
        </label>
        <SaveButton disabled={pending || Boolean(aliasHint?.blocks)} className="self-end">
          {pending ? 'Kısaltılıyor…' : 'Kısalt'}
        </SaveButton>
        <AliasHint id="alias-hint" hint={aliasHint} className="basis-full" />
      </form>
      <FilterPills
        ariaLabel="Kaynak"
        value={source}
        onChange={(next) => {
          if (next === source) return;
          setSource(next);
          setLoading(true);
        }}
        options={SOURCE_FILTERS}
      />
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
        canDisableManaged={moderate}
        filtered={source !== 'all'}
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
                  setHits(asHitList(await urlsApi.listHits(row.id)));
                } catch (err) {
                  setHits([]);
                  setHitsError(err instanceof ProblemError ? err.title : 'Tıklamalar yüklenemedi');
                }
              }
            : undefined
        }
        onDelete={removeRow}
      />
      {moderate ? (
        <UrlList
          title="Tümü"
          loading={loading}
          failed={Boolean(error)}
          items={all}
          showClicks
          canDisableManaged
          filtered={source !== 'all'}
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
              setHits(asHitList(await urlsApi.listHits(row.id)));
            } catch (err) {
              setHits([]);
              setHitsError(err instanceof ProblemError ? err.title : 'Tıklamalar yüklenemedi');
            }
          }}
          onDelete={removeRow}
        />
      ) : null}
      <Drawer open={qrRow !== null} onClose={() => setQrRow(null)} title="QR">
        {qrRow ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{publicShortUrl(qrRow.alias)}</p>
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
            <p className="text-muted-foreground text-sm">{publicShortUrl(hitsRow.alias)}</p>
            {hitsError ? <p className="text-destructive text-sm">{hitsError}</p> : null}
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
                  key={`${hitWhen(hit)}-${hit.ip}-${index}`}
                  title={formatApplicantWhen(hitWhen(hit))}
                  subtitle={`${hitChannel(hit)}${hit.ip} · ${hit.userAgent} · ${hit.referer || '—'} · ${hitUserLabel(hit)}`}
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
              if (editAliasHint?.blocks) return;
              setNotice(null);
              try {
                await urlsApi.update(editing.id, {
                  url: editTarget.trim(),
                  alias: editAlias.trim(),
                });
                setEditing(null);
                await load();
              } catch (err) {
                if (isManagedRefusal(err)) {
                  setEditing(null);
                  setNotice(managedRefusalMessage(editing));
                  await load();
                  return;
                }
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
                aria-describedby="edit-alias-hint"
                required
              />
            </label>
            <AliasHint id="edit-alias-hint" hint={editAliasHint} />
            <SaveButton disabled={Boolean(editAliasHint?.blocks)}>Kaydet</SaveButton>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}
