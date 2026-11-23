'use client';

import {
  DataList,
  DataListTitle,
  DescriptionList,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListFooter, ListPage, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { HandoffTargetForm, targetTitle } from '@/components/handoff/HandoffTargetForm';
import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';
import {
  ROOT_URL_OUTSIDE_DOMAIN,
  rootUrlAllowsHandoff,
  type HandoffTarget,
} from '@/lib/handoff/targets';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useListParams } from '@/lib/ui/use-list-params';

const PAGE_SIZE = 50;
type View = 'all' | 'on' | 'off';

function enabledFirst(targets: HandoffTarget[]): HandoffTarget[] {
  return [...targets].sort(
    (a, b) =>
      Number(b.enabled === true) - Number(a.enabled === true) ||
      a.clientId.localeCompare(b.clientId, 'tr'),
  );
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; targets: HandoffTarget[] }
  | { kind: 'forbidden' }
  | { kind: 'failed'; detail: string };

/** The one mark a row carries: open, closed, or an address the handoff cannot use. */
function HandoffState({ target }: { target: HandoffTarget }) {
  const allowed = rootUrlAllowsHandoff(target.rootUrl);
  if (target.enabled && !allowed) {
    return <StatusChip kind="cancelled" label="Adres uygun değil" />;
  }
  if (target.enabled) return <StatusChip kind="active" label="Açık" />;
  return <StatusChip kind="neutral" label={allowed ? 'Kapalı' : 'Açılamaz'} />;
}

/**
 * SkyApp'ten geçiş: the sites a SkyApp sign-in may carry on to (Keycloak's sky-handoff).
 * A row opens its settings beside the list.
 */
export default function HandoffTargetsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [params, setParams] = useListParams({ view: 'all' });
  const view: View = params.view === 'on' || params.view === 'off' ? params.view : 'all';
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', targets: enabledFirst(await handoffTargetsApi.list()) });
    } catch (error) {
      if (error instanceof HandoffProblemError && error.status === 403) {
        setState({ kind: 'forbidden' });
      } else {
        setState({
          kind: 'failed',
          detail:
            error instanceof HandoffProblemError ? error.detail : 'Liste yüklenemedi. Tekrar dene.',
        });
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const targets = useMemo(() => (state.kind === 'ready' ? state.targets : []), [state]);
  const searched = useMemo(
    () =>
      targets.filter((target) =>
        matchesQuery(params.q, targetTitle(target), target.clientId, target.rootUrl ?? ''),
      ),
    [targets, params.q],
  );

  if (state.kind === 'forbidden') {
    return <Forbidden pageTitle="SkyApp'ten geçiş" />;
  }

  const on = searched.filter((target) => target.enabled === true);
  const rows = view === 'on' ? on : view === 'off' ? searched.filter((t) => !t.enabled) : searched;
  const paged = paginateRows(rows, params.page, PAGE_SIZE);
  const open = panelNeighbours(paged.slice, params.panel, (target) => target.clientId);
  const filtered = Boolean(params.q.trim()) || view !== 'all';

  function replace(updated: HandoffTarget) {
    setState((current) =>
      current.kind === 'ready'
        ? {
            kind: 'ready',
            targets: current.targets.map((target) =>
              target.clientId === updated.clientId ? updated : target,
            ),
          }
        : current,
    );
  }

  const columns: DataListColumn<HandoffTarget>[] = [
    {
      id: 'site',
      width: 'minmax(0,1fr)',
      header: 'Site',
      cell: (target) => (
        <DataListTitle
          title={targetTitle(target)}
          subtitle={<span className={TEXT_SECONDARY}>{target.rootUrl || 'Kök adres yok'}</span>}
        />
      ),
    },
    {
      id: 'path',
      width: '12rem',
      from: 'md',
      header: 'Giriş kapısı yolu',
      cell: (target) => (
        <code className="text-secondary-foreground truncate font-mono text-xs">
          {target.signInPath || '—'}
        </code>
      ),
    },
    {
      id: 'state',
      width: { base: 'auto', sm: '10rem' },
      align: 'end',
      label: 'Durum',
      cell: (target) => <HandoffState target={target} />,
    },
  ];

  return (
    <ListPage
      title="SkyApp'ten geçiş"
      commands={
        <CommandBar label="Geçiş komutları">
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      summary={
        targets.length ? (
          <SummaryStrip
            items={[
              {
                key: 'on',
                label: 'Açık',
                value: targets.filter((target) => target.enabled === true).length,
                active: view === 'on',
                onSelect: () => setParams({ view: 'on' }),
              },
              {
                key: 'off',
                label: 'Kapalı',
                value: targets.filter((target) => !target.enabled).length,
                active: view === 'off',
                onSelect: () => setParams({ view: 'off' }),
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
          placeholder="Site adı ya da adres"
          searchLabel="Site ara"
          viewsLabel="Geçiş durumu"
          views={[
            { value: 'all', label: 'Hepsi', count: searched.length },
            { value: 'on', label: 'Açık', count: on.length },
            { value: 'off', label: 'Kapalı', count: searched.length - on.length },
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
          noun="site"
          onPage={(page) => setParams({ page })}
        />
      }
    >
      {state.kind === 'failed' ? (
        <EmptyState kind="failed" title={state.detail} onRetry={() => void load()} />
      ) : state.kind === 'ready' && rows.length === 0 ? (
        filtered ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
        ) : (
          <EmptyState kind="first-use" title="Hesap sisteminde uygulama yok" />
        )
      ) : (
        <DataList
          columns={columns}
          rows={paged.slice}
          getRowId={(target) => target.clientId}
          onRowSelect={(target) => setParams({ panel: target.clientId })}
          rowLabel={targetTitle}
          loading={state.kind === 'loading'}
          skeletonRows={4}
        />
      )}
      <SidePanel
        open={Boolean(open.row)}
        title={open.row ? targetTitle(open.row) : ''}
        dirty={dirty}
        onPrev={open.prev ? () => setParams({ panel: open.prev }) : undefined}
        onNext={open.next ? () => setParams({ panel: open.next }) : undefined}
        onClose={() => {
          setDirty(false);
          setParams({ panel: null });
        }}
      >
        {open.row ? (
          <>
            <ObjectCard title="Uygulama">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Uygulama kimliği', value: open.row.clientId },
                  { label: 'Kök adres', value: open.row.rootUrl || '—' },
                ]}
              />
              {!rootUrlAllowsHandoff(open.row.rootUrl) ? (
                <p className={`text-warning ${TEXT_SECONDARY}`}>{ROOT_URL_OUTSIDE_DOMAIN}</p>
              ) : null}
            </ObjectCard>
            <ObjectCard title="Geçiş">
              <HandoffTargetForm
                key={open.row.clientId}
                target={open.row}
                onSaved={replace}
                onForbidden={() => setState({ kind: 'forbidden' })}
                onDirty={setDirty}
              />
            </ObjectCard>
          </>
        ) : null}
      </SidePanel>
    </ListPage>
  );
}
