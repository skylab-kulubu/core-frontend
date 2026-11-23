'use client';

import { DataList, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListFooter, ListPage } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { canWriteSeason } from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useListParams } from '@/lib/ui/use-list-params';
import { useAppCan } from '@/lib/use-app-can';
import { NewSeasonDrawer } from './_parts/NewSeasonDrawer';
import { SeasonBar } from './_parts/SeasonBar';
import { seasonHref, seasonProgress, seasonRange } from './_parts/season-view';

const PAGE_SIZE = 50;
type View = 'all' | 'active' | 'passive';

/** Sezonlar: the club's terms; a row opens the season's own page. */
export default function SeasonsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const groups = user?.groups ?? [];
  // core's season.write (a DK member reads only); the group rule stands in when it cannot be read
  const canWrite = useAppCan(canWriteSeason(groups))('season.write');
  const [seasons, setSeasons] = useState<Season[]>([]);
  // Events per season, read once the seasons are in; a season whose list failed shows none
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [params, setParams] = useListParams({ view: 'all' });
  const view: View = params.view === 'active' || params.view === 'passive' ? params.view : 'all';
  // The server's clock is not the reader's: the bars wait for the browser
  const [now, setNow] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await seasonsApi.list();
      setSeasons(rows);
      setFailed(null);
      void Promise.allSettled(rows.map((row) => seasonsApi.listEvents(row.id))).then((lists) =>
        setEventCounts(
          Object.fromEntries(
            lists.flatMap((list, at) =>
              list.status === 'fulfilled' ? [[rows[at].id, list.value.length]] : [],
            ),
          ),
        ),
      );
    } catch (error) {
      setFailed(coreProblemMessage(error, 'Sezonlar yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNow(new Date());
    void load();
  }, [load]);

  const searched = useMemo(
    () => seasons.filter((season) => matchesQuery(params.q, season.name)),
    [seasons, params.q],
  );
  const counts = {
    all: searched.length,
    active: searched.filter((season) => season.active).length,
    passive: searched.filter((season) => !season.active).length,
  };
  const rows = searched.filter(
    (season) => view === 'all' || (view === 'active' ? season.active : !season.active),
  );
  const paged = paginateRows(rows, params.page, PAGE_SIZE);
  const filtered = Boolean(params.q.trim()) || view !== 'all';

  const columns: DataListColumn<Season>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Sezon',
      cell: (season) => (
        <DataListTitle
          title={season.name}
          subtitle={<span className={TEXT_SECONDARY}>{seasonRange(season) || 'Tarih yok'}</span>}
        />
      ),
    },
    {
      id: 'progress',
      width: '13rem',
      from: 'md',
      header: 'İlerleme',
      cell: (season) => (now ? <SeasonBar progress={seasonProgress(season, now)} compact /> : null),
    },
    {
      id: 'events',
      width: '6rem',
      from: 'sm',
      align: 'end',
      header: 'Etkinlik',
      cell: (season) => (
        <span className="text-secondary-foreground text-sm tabular-nums">
          {eventCounts[season.id] ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      width: { base: 'auto', sm: '6rem' },
      align: 'end',
      label: 'Durum',
      cell: (season) =>
        season.active ? (
          <StatusChip kind="active" />
        ) : (
          // Pasif is not an error: neutral, never red
          <StatusChip kind="neutral" label="Pasif" />
        ),
    },
  ];

  const empty = failed ? (
    <EmptyState kind="failed" title={failed} onRetry={() => void load()} />
  ) : filtered ? (
    <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
  ) : (
    <EmptyState
      kind="first-use"
      title="Henüz sezon yok"
      action={
        canWrite ? (
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Sezon ekle"
            showLabel
            onClick={() => setAdding(true)}
          />
        ) : null
      }
    />
  );

  return (
    <ListPage
      title="Sezonlar"
      commands={
        <CommandBar label="Sezon komutları">
          {canWrite ? (
            <Command primary icon={Plus} label="Sezon ekle" onClick={() => setAdding(true)} />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Sezon adı"
          searchLabel="Sezon ara"
          viewsLabel="Sezon durumu"
          views={[
            { value: 'all', label: 'Hepsi', count: counts.all },
            { value: 'active', label: 'Aktif', count: counts.active },
            { value: 'passive', label: 'Pasif', count: counts.passive },
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
          noun="sezon"
          onPage={(page) => setParams({ page })}
        />
      }
    >
      {!loading && (failed || rows.length === 0) ? (
        empty
      ) : (
        <DataList
          columns={columns}
          rows={paged.slice}
          getRowId={(season) => season.id}
          rowHref={(season) => seasonHref(season.id)}
          rowLabel={(season) => season.name}
          loading={loading}
          skeletonRows={3}
        />
      )}
      <NewSeasonDrawer
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(season) => {
          setAdding(false);
          router.push(seasonHref(season.id));
        }}
      />
    </ListPage>
  );
}
