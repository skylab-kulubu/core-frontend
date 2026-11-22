'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Plus, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { MapRegionDrawer } from '@/components/map-regions/MapRegionDrawer';
import { mapRegionProblem } from '@/components/map-regions/map-region-problems';
import { ProblemError } from '@/lib/api/core';
import { mapRegionsApi, type MapRegion } from '@/lib/api/map-regions';
import { listStatus } from '@/lib/list-status';
import {
  formatBBox,
  formatRegionBytes,
  regionErrorLabel,
  regionProgress,
  regionsInProgress,
  regionStatus,
} from '@/lib/map-regions-ui';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useAppCan } from '@/lib/use-app-can';
import { useNotify } from '@/lib/ui/use-notify';

/** How often the list is read again while a region is being prepared. */
export const REGION_POLL_MS = 5000;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; regions: MapRegion[] }
  | { kind: 'forbidden' }
  | { kind: 'failed'; detail: string };

function RegionDetail({ region }: { region: MapRegion }) {
  const progress = regionProgress(region);
  const size = formatRegionBytes(region.sizeBytes);
  const parts = [
    region.status === 'failed' ? regionErrorLabel(region.errorCode) : '',
    progress === null ? size : `${formatRegionBytes(region.progressBytes)} / ${size}`,
    region.sourceBuild ? `yapım ${region.sourceBuild}` : '',
    formatBBox(region.bbox),
  ].filter(Boolean);
  return (
    <span className="block space-y-1">
      <span className="block truncate">{parts.join(' · ')}</span>
      {progress !== null ? (
        <span
          role="progressbar"
          aria-label={`${region.name} hazırlanıyor`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-muted block h-1 w-full max-w-xs overflow-hidden rounded-full"
        >
          <span className="bg-skylab-400 block h-full" style={{ width: `${progress}%` }} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * Harita bölgeleri (ADMIN, YK: core's media:manage): the OpenStreetMap
 * extracts Event maps are drawn from and the point picker shows. A region is
 * asked for by its name and box; core extracts and uploads it.
 */
export default function MapRegionsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const notify = useNotify();
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

  const regions = state.kind === 'ready' ? state.regions : [];
  const polling = regionsInProgress(regions);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void load(true), REGION_POLL_MS);
    return () => clearInterval(timer);
  }, [polling, load]);

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
    setError(null);
    try {
      replace(await mapRegionsApi.retry(region.id));
    } catch (err) {
      setError(mapRegionProblem(err, 'Bölge yeniden istenemedi'));
    }
  }

  function askRetire(region: MapRegion) {
    if (!region.id) return;
    const id = region.id;
    confirm({
      title: `"${region.name}" kaldırılsın mı?`,
      description: 'Haritalar bu bölgeden çizilmez; dosyası kovada kalır.',
      actionLabel: 'Bölgeyi kaldır',
      failure: (error) => mapRegionProblem(error, 'Bölge kaldırılamadı'),
      onConfirm: async () => {
        replace(await mapRegionsApi.retire(id));
        notify.success('Bölge kaldırıldı');
      },
    });
  }

  if (state.kind === 'forbidden') {
    return (
      <div className="space-y-6">
        <PageHeader title="Harita bölgeleri" />
        <StateCard title="Bu sayfa ADMIN ve YK’ya açık" Icon={ShieldAlert} tone="warning" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Harita bölgeleri"
        actions={
          manages ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Bölge ekle"
              onClick={() => setAdding(true)}
            />
          ) : undefined
        }
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <StateCard
          title="Liste yüklenemedi"
          description={state.detail}
          Icon={CircleAlert}
          tone="danger"
        >
          <SaveButton type="button" onClick={() => void load()}>
            Tekrar dene
          </SaveButton>
        </StateCard>
      ) : (
        <ListPanel
          status={listStatus({
            loading: state.kind === 'loading',
            rowCount: regions.length,
            emptyMessage: 'Bölge yok',
          })}
        >
          {regions.map((region) => {
            const status = regionStatus(region.status);
            const canRetire =
              manages &&
              (region.status === 'requested' ||
                region.status === 'ready' ||
                region.status === 'failed');
            return (
              <ListItem
                key={region.id ?? region.name}
                title={region.name}
                subtitle={<RegionDetail region={region} />}
                trailing={
                  <span className="flex items-center gap-2">
                    <StatusChip kind={status.kind} label={status.label} />
                    {manages && region.status === 'failed' ? (
                      <ActionButton
                        icon={RotateCcw}
                        label="Tekrar dene"
                        onClick={() => void retry(region)}
                      />
                    ) : null}
                    {canRetire ? (
                      <ActionButton icon={X} label="Kaldır" onClick={() => askRetire(region)} />
                    ) : null}
                  </span>
                }
              />
            );
          })}
        </ListPanel>
      )}
      <MapRegionDrawer
        open={adding}
        onClose={() => setAdding(false)}
        taken={regions.filter((row) => row.status !== 'retired').map((row) => row.name)}
        onRequested={(region) => {
          replace(region);
          notify.success('Bölge istendi');
        }}
      />
      {confirmDialog}
    </div>
  );
}
