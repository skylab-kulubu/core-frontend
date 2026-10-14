'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FilterPills } from '@/components/chrome/ListToolbar';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { HorizontalBars } from '@/components/chrome/PanelChart';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StateCard } from '@/components/chrome/StateCard';
import { UrlList } from '@/components/urls/UrlList';
import { PageHeader } from '@/components/layout/PageHeader';
import { coreProblemMessage } from '@/lib/core-problems';
import { QrPreview } from '@/components/chrome/QrPreview';
import {
  asHitList,
  hitUserLabel,
  hitWhen,
  publicShortUrl,
  shortQrFileName,
  shortQrPath,
  shortQrUrl,
  urlsApi,
  type LinkKindFilter,
  type ShortUrl,
  type ShortUrlHit,
} from '@/lib/api/urls';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { canModerateUrls, canUseUrls } from '@/lib/auth/groups';
import { listStatus } from '@/lib/list-status';
import {
  isManagedRefusal,
  LINK_KIND_FILTERS,
  managedDeleteWarning,
  managedRefusalMessage,
} from '@/lib/short-links';
import { topClickUrls } from '@/lib/panel-charts';
import { useAuth } from '@/context/AuthContext';
import { useAppCanSince } from '@/lib/use-app-can';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** core's bare 409 on a short link's create or save: the alias is in use. */
const ALIAS_TAKEN = { 409: 'Bu kısa ad alınmış; başka bir ad seç.' };

export default function UrlsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const roles = user?.roles ?? [];
  const allowed = canUseUrls(groups, roles);
  const moderate = canModerateUrls(groups, roles);
  // core's url.moderateWrite: changing someone else's link. A DK member reads
  // everyone's links (url.moderate) but changes none; an older core without
  // the key answers url.moderate, and the group rule stands in when unread.
  const moderateWrite = useAppCanSince(moderate)('url.moderateWrite', 'url.moderate');
  const canChange = (row: ShortUrl) =>
    moderateWrite || (Boolean(user?.id) && row.createdBy === user?.id);
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
  const [editError, setEditError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<LinkKindFilter>('all');
  // Read when a load starts, so a reload after a change uses the kind chosen meanwhile
  const kindFilterRef = useRef<LinkKindFilter>('all');
  // Only the latest load fills the lists, so a slow answer for an older kind is dropped
  const loadSeq = useRef(0);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    if (!allowed) return;
    const seq = ++loadSeq.current;
    const kind = kindFilterRef.current;
    try {
      const mineRows = await urlsApi.listMine(kind);
      if (seq !== loadSeq.current) return;
      setMine(mineRows);
      if (moderate) {
        const allRows = await urlsApi.listAll(kind);
        if (seq !== loadSeq.current) return;
        setAll(allRows);
      } else {
        setAll([]);
      }
      setError(null);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(coreProblemMessage(err, 'URL’ler yüklenemedi'));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [allowed, moderate]);

  useEffect(() => {
    void load();
  }, [load, kindFilter]);

  /**
   * A list read before a Form or an Event took the link: core answers 409
   * managed. The reload shows the link as it is now; the caller says why.
   */
  function reloadOnManaged(err: unknown) {
    if (isManagedRefusal(err)) void load();
  }

  function refusalText(
    err: unknown,
    row: ShortUrl,
    fallback: string,
    statusText: Partial<Record<number, string>> = {},
  ): string {
    if (isManagedRefusal(err)) return managedRefusalMessage(row);
    return coreProblemMessage(err, fallback, statusText);
  }

  function askDelete(row: ShortUrl) {
    const warning = managedDeleteWarning(row);
    confirm({
      title: `${publicShortUrl(row.alias)} silinsin mi?`,
      description: [warning, 'Link çalışmayı bırakır; tıklayan sayfa bulunamadı görür.', UNDO_HINT]
        .filter(Boolean)
        .join(' '),
      actionLabel: 'Linki sil',
      onConfirm: async () => {
        try {
          await urlsApi.remove(row.id);
        } catch (err) {
          reloadOnManaged(err);
          throw err;
        }
        notify.undoable(
          'Kısa link silindi',
          async () => {
            await urlsApi.restore(row.id);
            void load();
          },
          'Kısa link geri alındı',
        );
        await load();
      },
      failure: (err) =>
        refusalText(err, row, 'Kısa link silinemedi', { 409: 'Kısa link şu an silinemiyor.' }),
    });
  }

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
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
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
            notify.success('Kısa link oluşturuldu');
            await load();
          } catch (err) {
            setError(coreProblemMessage(err, 'Kısaltılamadı', ALIAS_TAKEN));
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
      <FilterPills
        ariaLabel="Link türü"
        value={kindFilter}
        onChange={(next) => {
          if (next === kindFilter) return;
          kindFilterRef.current = next;
          setKindFilter(next);
          setLoading(true);
        }}
        options={LINK_KIND_FILTERS}
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
        canDeleteManaged={moderateWrite}
        filtered={kindFilter !== 'all'}
        onEdit={(row) => {
          setEditing(row);
          setEditError(null);
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
                  setHitsError(coreProblemMessage(err, 'Tıklamalar yüklenemedi'));
                }
              }
            : undefined
        }
        onDelete={askDelete}
      />
      {moderate ? (
        <UrlList
          title="Tümü"
          loading={loading}
          failed={Boolean(error)}
          items={all}
          showClicks
          canChange={canChange}
          canDeleteManaged={moderateWrite}
          filtered={kindFilter !== 'all'}
          onEdit={(row) => {
            setEditing(row);
            setEditError(null);
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
              setHitsError(coreProblemMessage(err, 'Tıklamalar yüklenemedi'));
            }
          }}
          onDelete={askDelete}
        />
      ) : null}
      {confirmDialog}
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
              setEditError(null);
              try {
                await urlsApi.update(editing.id, {
                  url: editTarget.trim(),
                  alias: editAlias.trim(),
                });
                setEditing(null);
                notify.success('Kısa link kaydedildi');
                await load();
              } catch (err) {
                setEditError(refusalText(err, editing, 'Güncellenemedi', ALIAS_TAKEN));
                reloadOnManaged(err);
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
            {editError ? (
              <p role="alert" className="text-destructive text-sm">
                {editError}
              </p>
            ) : null}
            <SaveButton>Kaydet</SaveButton>
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}
