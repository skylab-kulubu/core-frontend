'use client';

import { DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { DataList } from '@/components/chrome/DataList';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPage, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import { appsApi, type AppSummary } from '@/lib/api/apps';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useListParams } from '@/lib/ui/use-list-params';
import { useAppCan } from '@/lib/use-app-can';
import { AppMark } from './_parts/AppMark';
import { accessLabel, assignmentCount } from './_parts/app-view';

type View = 'all' | 'assigned' | 'open';

/** Uygulamalar: Entra's Enterprise apps list (core /v1/apps); a row opens the app. */
export default function AppsPage() {
  const capabilities = useCapabilities();
  const canRead = useAppCan(false)('apps.read');
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [params, setParams] = useListParams({ view: 'all' });
  const view: View = params.view === 'assigned' || params.view === 'open' ? params.view : 'all';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApps(await appsApi.list());
      setFailed(null);
    } catch (error) {
      setFailed(coreProblemMessage(error, 'Uygulamalar yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const searched = useMemo(
    () => apps.filter((app) => matchesQuery(params.q, app.name, app.clientId)),
    [apps, params.q],
  );

  if (capabilities.status === 'loading') return <PageSkeleton variant="list" />;
  if (!canRead) return <Forbidden pageTitle="Uygulamalar" />;

  const assigned = searched.filter((app) => app.assignmentRequired);
  const rows =
    view === 'assigned'
      ? assigned
      : view === 'open'
        ? searched.filter((app) => !app.assignmentRequired)
        : searched;
  const paged = paginateRows(rows, params.page, params.size);
  const filtered = Boolean(params.q.trim()) || view !== 'all';

  const columns: DataListColumn<AppSummary>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Uygulama',
      cell: (app) => (
        <span className="flex min-w-0 items-center gap-3">
          <AppMark name={app.name} />
          <DataListTitle
            title={app.name}
            subtitle={
              <span className={TEXT_SECONDARY}>
                {app.roles.length ? `${app.roles.length} rol` : 'Rol yok'}
              </span>
            }
          />
        </span>
      ),
    },
    {
      id: 'reach',
      width: '9rem',
      from: 'sm',
      header: 'Atama',
      cell: (app) => (
        <span className="text-secondary-foreground text-sm tabular-nums">
          {assignmentCount(app)}
        </span>
      ),
    },
    {
      id: 'access',
      width: { base: 'auto', sm: '10rem' },
      align: 'end',
      label: 'Erişim',
      cell: (app) => <StatusChip kind="neutral" label={accessLabel(app)} />,
    },
  ];

  return (
    <ListPage
      title="Uygulamalar"
      commands={
        <CommandBar label="Uygulama komutları">
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      summary={
        apps.length ? (
          <SummaryStrip
            items={[
              {
                key: 'all',
                label: 'Uygulama',
                value: apps.length,
                active: view === 'all',
                onSelect: () => setParams({ view: 'all' }),
              },
              {
                key: 'assigned',
                label: 'Yalnız atananlar',
                value: apps.filter((app) => app.assignmentRequired).length,
                active: view === 'assigned',
                onSelect: () => setParams({ view: 'assigned' }),
              },
              {
                key: 'groups',
                label: 'Grup ataması',
                value: apps.reduce((sum, app) => sum + app.groups, 0),
              },
              {
                key: 'users',
                label: 'Kişi ataması',
                value: apps.reduce((sum, app) => sum + app.users, 0),
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
          placeholder="Uygulama adı"
          searchLabel="Uygulama ara"
          viewsLabel="Erişim"
          views={[
            { value: 'all', label: 'Hepsi', count: searched.length },
            { value: 'assigned', label: 'Yalnız atananlar', count: assigned.length },
            { value: 'open', label: 'Herkese açık', count: searched.length - assigned.length },
          ]}
          view={view}
          onView={(next) => setParams({ view: next })}
        />
      }
      paging={{
        total: rows.length,
        page: paged.page,
        pageSize: params.size,
        onPage: (page) => setParams({ page }),
        onPageSize: (size) => setParams({ size }),
      }}
    >
      {!loading && (failed || rows.length === 0) ? (
        failed ? (
          <EmptyState kind="failed" title={failed} onRetry={() => void load()} />
        ) : filtered ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
        ) : (
          <EmptyState kind="first-use" title="Uygulama yok" />
        )
      ) : (
        <DataList
          columns={columns}
          rows={paged.slice}
          getRowId={(app) => app.clientId}
          rowHref={(app) => `/apps/${encodeURIComponent(app.clientId)}`}
          rowLabel={(app) => app.name}
          loading={loading}
          skeletonRows={3}
        />
      )}
    </ListPage>
  );
}
