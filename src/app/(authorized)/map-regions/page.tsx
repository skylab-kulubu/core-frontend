'use client';

import {
  DataList,
  DataListTitle,
  DescriptionList,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { Plus, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ListFooter, ListPage, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { MapRegionDrawer } from '@/components/map-regions/MapRegionDrawer';
import { mapRegionProblem } from '@/components/map-regions/map-region-problems';
import { RegionBoxPreview } from '@/components/map-regions/RegionBoxPreview';
import { ProblemError } from '@/lib/api/core';
import { mapRegionsApi, type MapRegion } from '@/lib/api/map-regions';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import {
  formatBBox,
  formatRegionBytes,
  regionErrorLabel,
  regionProgress,
  regionsInProgress,
  regionStatus,
} from '@/lib/map-regions-ui';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useListParams } from '@/lib/ui/use-list-params';
import { useAppCan } from '@/lib/use-app-can';
import { useNotify } from '@/lib/ui/use-notify';

/** How often the list is read again while a region is being prepared. */
export const REGION_POLL_MS = 5000;

const PAGE_SIZE = 50;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; regions: MapRegion[] }
  | { kind: 'forbidden' }
  | { kind: 'failed'; detail: string };

/** The views over the list: by where a region is. */
type View = 'all' | 'ready' | 'preparing' | 'failed' | 'retired';

function viewOf(region: MapRegion): Exclude<View, 'all'> {
  switch (region.status) {
    case 'requested':
    case 'extracting':
      return 'preparing';
    case 'failed':
      return 'failed';
    case 'retired':
      return 'retired';
    default:
      return 'ready';
  }
}

const DAY = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});
const when = (iso?: string) => (iso ? DAY.format(new Date(iso)) : '—');
const regionId = (region: MapRegion) => region.id ?? region.name;

/** The progress of an extract: a thin bar and "61 MB / 150 MB". */
function RegionProgress({ region }: { region: MapRegion }) {
  const progress = regionProgress(region);
  if (progress === null) return null;
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-label={`${region.name} hazırlanıyor`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted block h-1 w-24 overflow-hidden rounded-full"
      >
        <span className="bg-skylab-400 block h-full" style={{ width: `${progress}%` }} />
      </span>
      <span className={`text-subtle-foreground tabular-nums ${TEXT_SECONDARY}`}>
        {formatRegionBytes(region.progressBytes)} / {formatRegionBytes(region.sizeBytes)}
      </span>
    </span>
  );
}

/** A row's second line: its progress, its failure, or when it was last changed. */
function rowLine(region: MapRegion): ReactNode {
  if (regionProgress(region) !== null) return <RegionProgress region={region} />;
  if (region.status === 'failed') return regionErrorLabel(region.errorCode);
  if (region.status === 'requested') return 'Sırada';
  return `Son değişiklik ${when(region.readyAt ?? region.createdAt)}`;
}

/**
 * Harita bölgeleri (ADMIN, YK: core's media:manage): the OpenStreetMap extracts Event maps
 * are drawn from and the point picker shows. A region is asked for by its name and box; core
 * extracts and uploads it. A row opens its details, retry and retire beside the list.
 */
export default function MapRegionsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  // A failed retry belongs to its region: said in that region's panel, or above the list once
  // the panel is closed (on a phone the panel covers the list)
  const [retryError, setRetryError] = useState<{ id: string; text: string } | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const notify = useNotify();
  const [params, setParams] = useListParams({ view: 'all' });
  const view: View = (['ready', 'preparing', 'failed', 'retired'] as const).includes(
    params.view as Exclude<View, 'all'>,
  )
    ? (params.view as View)
    : 'all';
  // core answers anyone signed in the ready regions; asking, retrying and retiring are
  // media:manage's (core's media.delete decision). Unreadable decisions leave it to core.
  const manages = useAppCan(true)('media.delete');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState({ kind: 'loading' });
    try {
      const regions = await mapRegionsApi.list();
      setState({ kind: 'ready', regions: Array.isArray(regions) ? regions : [] });
    } catch (error) {
      if (error instanceof ProblemError && error.status === 403) {
        setState({ kind: 'forbidden' });
      } else if (!quiet) {
        setState({ kind: 'failed', detail: mapRegionProblem(error, 'Liste yüklenemedi') });
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const regions = useMemo(() => (state.kind === 'ready' ? state.regions : []), [state]);
  const polling = regionsInProgress(regions);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void load(true), REGION_POLL_MS);
    return () => clearInterval(timer);
  }, [polling, load]);

  const searched = useMemo(
    () => regions.filter((region) => matchesQuery(params.q, region.name)),
    [regions, params.q],
  );

  if (state.kind === 'forbidden') {
    return <Forbidden pageTitle="Harita bölgeleri" />;
  }

  const count = (which: Exclude<View, 'all'>) =>
    searched.filter((region) => viewOf(region) === which).length;
  const rows = view === 'all' ? searched : searched.filter((region) => viewOf(region) === view);
  const paged = paginateRows(rows, params.page, PAGE_SIZE);
  const open = panelNeighbours(paged.slice, params.panel, regionId);
  const filtered = Boolean(params.q.trim()) || view !== 'all';
  const live = regions.filter((region) => region.status !== 'retired');
  const totalBytes = live
    .filter((region) => region.status === 'ready')
    .reduce((sum, region) => sum + (region.sizeBytes ?? 0), 0);

  function replace(updated: MapRegion) {
    setState((current) =>
      current.kind === 'ready'
        ? {
            kind: 'ready',
            regions: current.regions.some((row) => row.id === updated.id)
              ? current.regions.map((row) => (row.id === updated.id ? updated : row))
              : [updated, ...current.regions],
          }
        : current,
    );
  }

  async function retry(region: MapRegion) {
    if (!region.id) return;
    const id = region.id;
    setRetryError(null);
    try {
      replace(await mapRegionsApi.retry(id));
    } catch (err) {
      setRetryError({ id, text: mapRegionProblem(err, 'Bölge yeniden istenemedi') });
    }
  }

  function askRetire(region: MapRegion) {
    if (!region.id) return;
    const id = region.id;
    confirm({
      title: `"${region.name}" kaldırılsın mı?`,
      description: 'Haritalar bu bölgeyi artık kullanmaz.',
      actionLabel: 'Bölgeyi kaldır',
      failure: (error) => mapRegionProblem(error, 'Bölge kaldırılamadı'),
      onConfirm: async () => {
        replace(await mapRegionsApi.retire(id));
        notify.success('Bölge kaldırıldı');
      },
    });
  }

  const canRetire = (region: MapRegion) =>
    manages &&
    (region.status === 'requested' || region.status === 'ready' || region.status === 'failed');

  const columns: DataListColumn<MapRegion>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Bölge',
      cell: (region) => (
        <DataListTitle
          title={region.name}
          subtitle={<span className={TEXT_SECONDARY}>{rowLine(region)}</span>}
        />
      ),
    },
    {
      id: 'size',
      width: '6.5rem',
      from: 'sm',
      align: 'end',
      header: 'Boyut',
      cell: (region) => (
        <span className="text-secondary-foreground text-sm tabular-nums">
          {formatRegionBytes(region.sizeBytes) || '—'}
        </span>
      ),
    },
    {
      id: 'status',
      width: { base: 'auto', sm: '8rem' },
      align: 'end',
      label: 'Durum',
      cell: (region) => {
        const status = regionStatus(region.status);
        return <StatusChip kind={status.kind} label={status.label} />;
      },
    },
  ];

  const row = open.row;

  return (
    <ListPage
      title="Harita bölgeleri"
      commands={
        <CommandBar label="Bölge komutları">
          {manages ? (
            <Command primary icon={Plus} label="Bölge ekle" onClick={() => setAdding(true)} />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      summary={
        regions.length ? (
          <SummaryStrip
            items={[
              {
                key: 'ready',
                label: 'Hazır',
                value: regions.filter((region) => viewOf(region) === 'ready').length,
                active: view === 'ready',
                onSelect: () => setParams({ view: 'ready' }),
              },
              {
                key: 'preparing',
                label: 'Hazırlanıyor',
                value: regions.filter((region) => viewOf(region) === 'preparing').length,
                active: view === 'preparing',
                onSelect: () => setParams({ view: 'preparing' }),
              },
              {
                key: 'failed',
                label: 'Hata',
                value: regions.filter((region) => viewOf(region) === 'failed').length,
                active: view === 'failed',
                onSelect: () => setParams({ view: 'failed' }),
              },
              {
                key: 'size',
                label: 'Toplam boyut',
                value: formatRegionBytes(totalBytes) || '0 MB',
              },
            ]}
          />
        ) : null
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Bölge adı"
          searchLabel="Bölge ara"
          viewsLabel="Bölge durumu"
          views={[
            { value: 'all', label: 'Hepsi', count: searched.length },
            { value: 'ready', label: 'Hazır', count: count('ready') },
            { value: 'preparing', label: 'Hazırlanıyor', count: count('preparing') },
            { value: 'failed', label: 'Hata', count: count('failed') },
            { value: 'retired', label: 'Kaldırılan', count: count('retired') },
          ]}
          view={view}
          onView={(next) => setParams({ view: next })}
        />
      }
      footer={
        <ListFooter
          total={rows.length}
          page={paged.page}
          totalPages={paged.totalPages}
          noun="bölge"
          onPage={(page) => setParams({ page })}
        />
      }
    >
      {retryError && !row ? (
        <p role="alert" className="text-destructive text-sm">
          {retryError.text}
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState kind="failed" title={state.detail} onRetry={() => void load()} />
      ) : state.kind === 'ready' && rows.length === 0 ? (
        filtered ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
        ) : (
          <EmptyState kind="first-use" title="Henüz bölge yok" />
        )
      ) : (
        <DataList
          columns={columns}
          rows={paged.slice}
          getRowId={regionId}
          onRowSelect={(region) => setParams({ panel: regionId(region) })}
          rowLabel={(region) => region.name}
          loading={state.kind === 'loading'}
          skeletonRows={4}
        />
      )}
      <SidePanel
        open={Boolean(row)}
        title={row?.name ?? ''}
        onPrev={open.prev ? () => setParams({ panel: open.prev }) : undefined}
        onNext={open.next ? () => setParams({ panel: open.next }) : undefined}
        onClose={() => setParams({ panel: null })}
      >
        {row ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                kind={regionStatus(row.status).kind}
                label={regionStatus(row.status).label}
              />
              <RegionProgress region={row} />
            </div>
            {row.status === 'failed' ? (
              <ObjectCard title="Neden">
                <p className="text-sm">{regionErrorLabel(row.errorCode)}</p>
              </ObjectCard>
            ) : null}
            <ObjectCard title="Kapsam">
              <RegionBoxPreview box={row.bbox} name={row.name} />
            </ObjectCard>
            <ObjectCard title="Ayrıntılar">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Boyut', value: formatRegionBytes(row.sizeBytes) || '—' },
                  { label: 'Kutu (boylam · enlem)', value: formatBBox(row.bbox) },
                  { label: 'En yakın görünüm', value: String(row.maxZoom) },
                  { label: 'Harita sürümü', value: row.sourceBuild || '—' },
                  { label: 'İstendi', value: when(row.createdAt) },
                  { label: 'Hazır', value: when(row.readyAt) },
                ]}
              />
            </ObjectCard>
            {retryError && retryError.id === row.id ? (
              <p role="alert" className="text-destructive text-sm">
                {retryError.text}
              </p>
            ) : null}
            {manages && (row.status === 'failed' || canRetire(row)) ? (
              <CommandBar label="Bölge komutları">
                {row.status === 'failed' ? (
                  <Command
                    primary
                    icon={RotateCcw}
                    label="Tekrar dene"
                    onClick={() => void retry(row)}
                  />
                ) : null}
                {canRetire(row) ? (
                  <Command icon={X} label="Kaldır" onClick={() => askRetire(row)} />
                ) : null}
              </CommandBar>
            ) : null}
          </>
        ) : null}
      </SidePanel>
      <MapRegionDrawer
        open={adding}
        onClose={() => setAdding(false)}
        taken={live.map((region) => region.name)}
        onRequested={(region) => {
          replace(region);
          notify.success('Bölge istendi');
        }}
      />
      {confirmDialog}
    </ListPage>
  );
}
