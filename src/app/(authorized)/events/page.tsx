'use client';

import { useNewEvent } from '@/components/scheduling/NewEventProvider';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DataList,
  DataListTitle,
  FilterPills as Pills,
  Sparkline,
  cn,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { ImageIcon, Plus, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ColumnPicker, useColumnChoice, type ColumnChoice } from '@/components/chrome/ColumnPicker';
import { ListFooter, ListPage, RowMenu, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { EventCalendar } from '@/components/scheduling/EventCalendar';
import { useEventCopy } from '@/components/scheduling/EventCopyDialog';
import { EventListPanel, ShareBar } from '@/components/scheduling/EventListPanel';
import {
  eventRowMenuItems,
  useEventStatusActions,
  useEventStatusRights,
} from '@/components/scheduling/use-event-status-actions';
import { coreProblemMessage } from '@/lib/core-problems';
import { dashboardApi, type EventStat } from '@/lib/api/dashboard';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { publicMediaUrl } from '@/lib/event-media';
import { useEventCreate } from '@/lib/use-event-create';
import {
  countEventsByStatus,
  EVENT_SORTS,
  EVENT_STATUS_FILTERS,
  eventDisplayStatus,
  eventGapLine,
  eventGaps,
  eventSortFrom,
  eventStatusFilterFrom,
  filterEventsByStatus,
  formatEventWhen,
  sortEvents,
  type EventStatusFilter,
} from '@/lib/events-view';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { useAuth } from '@/context/AuthContext';
import { formHandoffFromSearch } from '@/lib/event-forms';
import { useListParams } from '@/lib/ui/use-list-params';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const PAGE_SIZE = 50;

const COLUMNS: readonly ColumnChoice[] = [
  { id: 'event', label: 'Etkinlik', fixed: true },
  { id: 'when', label: 'Tarih' },
  { id: 'registrations', label: 'Kayıt' },
  { id: 'checkins', label: 'Giriş' },
  { id: 'trend', label: 'Son 14 gün' },
  { id: 'status', label: 'Durum', fixed: true },
];

/**
 * The figures of every Event the reader may read the applicants of. An older core answers
 * the list's own call 404: the dashboard's figures (running, coming and recent Events) stand
 * in. None at all leaves the rows without figures; the list itself still works.
 */
function useEventStats() {
  const [stats, setStats] = useState<ReadonlyMap<string, EventStat>>(new Map());
  const load = useCallback(async () => {
    let rows: EventStat[] = [];
    try {
      rows = (await eventsApi.stats()).eventStats ?? [];
    } catch {
      try {
        rows = (await dashboardApi.summary()).eventStats ?? [];
      } catch {
        rows = [];
      }
    }
    setStats(new Map(rows.map((row) => [row.id, row])));
  }, []);
  return { stats, load };
}

/** The cover at a glance, 16:9 and uncropped; a placeholder when there is none. */
function Cover({ src }: { src?: string }) {
  const url = src?.trim() ? publicMediaUrl(src) : '';
  return (
    <span className="bg-muted border-border-subtle grid aspect-video w-16 shrink-0 place-items-center overflow-hidden rounded-md border">
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-contain" />
      ) : (
        <ImageIcon className="text-subtle-foreground size-4" aria-hidden />
      )}
    </span>
  );
}

const percent = (part: number, whole: number) =>
  whole > 0 ? `%${Math.round((part / whole) * 100)}` : '';

function EventsPageContent() {
  const router = useRouter();
  const { open: openNewEvent } = useNewEvent();
  const searchParams = useSearchParams();
  const ownerFilter = searchParams.get('ownerTeam')?.trim() || '';
  const [params, setParams] = useListParams({ view: 'list' });
  const calendar = params.view === 'calendar';
  const statusFilter = eventStatusFilterFrom(searchParams.get('status'));
  const sort = eventSortFrom(params.sort);
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { stats, load: loadStats } = useEventStats();
  const columns = useColumnChoice('skylab.admin.columns.events', COLUMNS);
  // The group rule narrowed by core's event.create: a DK member reads, creates nothing
  const { canCreate } = useEventCreate(groups);
  const rightsFor = useEventStatusRights();
  const replaceEvent = (next: CoreEvent) =>
    setEvents((rows) =>
      rows.some((row) => row.id === next.id)
        ? rows.map((row) => (row.id === next.id ? next : row))
        : [...rows, next],
    );
  const statusActions = useEventStatusActions({
    onChanged: (next) => {
      setActionError(null);
      replaceEvent(next);
    },
    onError: setActionError,
  });
  const copy = useEventCopy();

  /** The status slice and the team stay in their own address keys, as the links to them write. */
  function setAddress(name: 'status' | 'ownerTeam', value: string | null) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('page');
    const q = next.toString();
    window.history.replaceState(null, '', q ? `/events?${q}` : '/events');
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Drafts too: core adds the ones the reader may see (their editors, DK)
      setEvents(await eventsApi.list(ownerFilter || undefined, undefined, { drafts: true }));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Etkinlikler yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, [ownerFilter]);

  useEffect(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  useEffect(() => {
    const handoff = formHandoffFromSearch(searchParams);
    if (!handoff) return;
    const next = new URLSearchParams(searchParams.toString());
    router.replace(`/events/new?${next.toString()}`);
  }, [searchParams, router]);

  const searched = useMemo(
    () => events.filter((ev) => matchesQuery(params.q, ev.name, ev.ownerTeam, ev.location)),
    [events, params.q],
  );
  const counts = useMemo(() => countEventsByStatus(searched), [searched]);
  const filtered = useMemo(
    () =>
      filterEventsByStatus(
        sortEvents(searched, sort, (ev) => stats.get(ev.id)?.applications ?? 0),
        statusFilter,
      ),
    [searched, statusFilter, sort, stats],
  );
  const paged = paginateRows(filtered, params.page, PAGE_SIZE);
  // The panel steps through the rows shown: the page in the list, the month's Events in the calendar
  const open = panelNeighbours(calendar ? filtered : paged.slice, params.panel, (ev) => ev.id);
  const openEvent = open.row ?? (params.panel ? events.find((ev) => ev.id === params.panel) : null);

  const summary = useMemo(() => {
    const all = countEventsByStatus(events);
    const drafts = filterEventsByStatus(events, 'draft');
    const lacking = drafts.filter((ev) => eventGaps(ev).length > 0).length;
    const daily = Array<number>(14).fill(0);
    for (const stat of stats.values()) {
      stat.dailyApplications.forEach((n, i) => {
        if (i < daily.length) daily[i] += n;
      });
    }
    const recent = daily.reduce((sum, n) => sum + n, 0);
    const lastWeek = daily.slice(7).reduce((sum, n) => sum + n, 0);
    const weekBefore = daily.slice(0, 7).reduce((sum, n) => sum + n, 0);
    return { all, lacking, daily, recent, lastWeek, weekBefore };
  }, [events, stats]);

  const pick = (slice: EventStatusFilter) =>
    setAddress('status', statusFilter === slice ? null : slice);

  const listColumns: DataListColumn<CoreEvent>[] = [
    {
      id: 'event',
      width: 'minmax(0,1fr)',
      header: 'Etkinlik',
      cell: (ev) => {
        const gaps = eventGaps(ev);
        const when = formatEventWhen(ev);
        return (
          <DataListTitle
            leading={<Cover src={ev.coverImageUrl} />}
            title={ev.name}
            subtitle={
              <span className={cn('flex min-w-0 flex-col', TEXT_SECONDARY)}>
                <span className="truncate">
                  {[ev.ownerTeam?.trim() || 'Genel', ev.location?.trim()]
                    .filter(Boolean)
                    .join(' · ')}
                  {when ? <span className="md:hidden"> · {when}</span> : null}
                </span>
                {gaps.length ? (
                  <span className="text-warning inline-flex items-center gap-1">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                    {eventGapLine(gaps)}
                  </span>
                ) : null}
              </span>
            }
          />
        );
      },
    },
    ...(columns.isShown('when')
      ? [
          {
            id: 'when',
            width: '10.5rem',
            from: 'md' as const,
            header: 'Tarih',
            cell: (ev: CoreEvent) => (
              <span className="text-secondary-foreground text-[13px]/5 tabular-nums">
                {formatEventWhen(ev) || 'Tarihsiz'}
              </span>
            ),
          },
        ]
      : []),
    ...(columns.isShown('registrations')
      ? [
          {
            id: 'registrations',
            width: '8.5rem',
            from: 'md' as const,
            header: 'Kayıt',
            cell: (ev: CoreEvent) => {
              const stat = stats.get(ev.id);
              if (!stat) return <span className="text-subtle-foreground text-[13px]/5">—</span>;
              return (
                <span className="flex w-full flex-col gap-1">
                  <span className="text-foreground text-[13px]/5 tabular-nums">
                    {stat.applications}
                    {ev.capacity > 0 ? (
                      <span className="text-subtle-foreground"> / {ev.capacity}</span>
                    ) : null}
                  </span>
                  {ev.capacity > 0 ? <ShareBar share={stat.applications / ev.capacity} /> : null}
                </span>
              );
            },
          },
        ]
      : []),
    ...(columns.isShown('checkins')
      ? [
          {
            id: 'checkins',
            width: '6.5rem',
            from: 'lg' as const,
            header: 'Giriş',
            cell: (ev: CoreEvent) => {
              const stat = stats.get(ev.id);
              if (!stat) return <span className="text-subtle-foreground text-[13px]/5">—</span>;
              return (
                <span className="text-foreground text-[13px]/5 tabular-nums">
                  {stat.checkedIn}
                  {stat.applications ? (
                    <span className="text-subtle-foreground">
                      {' '}
                      · {percent(stat.checkedIn, stat.applications)}
                    </span>
                  ) : null}
                </span>
              );
            },
          },
        ]
      : []),
    ...(columns.isShown('trend')
      ? [
          {
            id: 'trend',
            width: '6.5rem',
            from: 'lg' as const,
            header: 'Son 14 gün',
            cell: (ev: CoreEvent) => {
              const stat = stats.get(ev.id);
              const any = stat?.dailyApplications.some((n) => n > 0);
              return any ? (
                <Sparkline values={stat!.dailyApplications} className="h-6 w-full" />
              ) : (
                <span className="text-subtle-foreground text-[13px]/5">—</span>
              );
            },
          },
        ]
      : []),
    {
      id: 'status',
      width: { base: 'auto', sm: '6.5rem' },
      label: 'Durum',
      cell: (ev) => <StatusChip kind={eventDisplayStatus(ev)} />,
    },
    {
      id: 'actions',
      width: '2rem',
      label: 'Eylemler',
      interactive: true,
      cell: (ev) => {
        const menu = eventRowMenuItems(ev, rightsFor(ev), statusActions, {
          onDeleted: () => setEvents((rows) => rows.filter((row) => row.id !== ev.id)),
          onRestored: replaceEvent,
          onCopy: copy.canCopy(ev) ? () => copy.askCopy(ev) : undefined,
        });
        return menu.length ? <RowMenu rowName={ev.name}>{menu}</RowMenu> : null;
      },
    },
  ];

  const filteredView = Boolean(params.q.trim()) || statusFilter !== 'all';
  const empty = error ? (
    <EmptyState kind="failed" title={error} onRetry={() => void load()} />
  ) : filteredView ? (
    <EmptyState
      kind="no-results"
      onClear={() => {
        setAddress('status', null);
        setParams({ q: '' });
      }}
    />
  ) : (
    <EmptyState
      kind="first-use"
      title="Henüz etkinlik yok"
      action={
        canCreate ? (
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Etkinlik ekle"
            onClick={openNewEvent}
          />
        ) : undefined
      }
    />
  );

  const viewSwitch = (
    <div className="[&_button]:whitespace-nowrap">
      <Pills
        aria-label="Görünüm"
        value={calendar ? 'calendar' : 'list'}
        onValueChange={(next) => setParams({ view: next, panel: null })}
        options={[
          { value: 'list', label: 'Liste' },
          { value: 'calendar', label: 'Takvim' },
        ]}
      />
    </div>
  );

  return (
    <ListPage
      title="Etkinlikler"
      commands={
        <CommandBar label="Etkinlik komutları">
          {canCreate ? (
            <Command primary icon={Plus} label="Etkinlik ekle" onClick={openNewEvent} />
          ) : null}
          <Command
            icon={RefreshCw}
            label="Yenile"
            onClick={() => {
              void load();
              void loadStats();
            }}
          />
        </CommandBar>
      }
      summary={
        events.length ? (
          <SummaryStrip
            items={[
              {
                key: 'live',
                label: 'Sürüyor',
                value: summary.all.live,
                active: statusFilter === 'live',
                onSelect: () => pick('live'),
              },
              {
                key: 'upcoming',
                label: 'Yaklaşan',
                value: summary.all.upcoming,
                active: statusFilter === 'upcoming',
                onSelect: () => pick('upcoming'),
              },
              {
                key: 'draft',
                label: 'Taslak',
                value: summary.all.draft,
                hint: summary.lacking ? (
                  <span className={cn('text-warning', TEXT_SECONDARY)}>
                    {summary.lacking} eksikli
                  </span>
                ) : undefined,
                active: statusFilter === 'draft',
                onSelect: () => pick('draft'),
              },
              {
                key: 'registrations',
                label: 'Son 14 gün kayıt',
                value: summary.recent,
                hint: stats.size ? (
                  <span className="flex flex-col gap-1">
                    <Sparkline values={summary.daily} className="h-6 w-full" />
                    <span className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
                      Bu hafta {summary.lastWeek} · önceki {summary.weekBefore}
                    </span>
                  </span>
                ) : undefined,
              },
            ]}
          />
        ) : null
      }
      toolbar={
        <ListToolbar<EventStatusFilter>
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Ad, ekip, yer"
          searchLabel="Etkinlik ara"
          views={EVENT_STATUS_FILTERS.map((row) => ({ ...row, count: counts[row.value] }))}
          view={statusFilter}
          onView={(value) => setAddress('status', value === 'all' ? null : value)}
          viewsLabel="Etkinlik durumu"
          sort={
            calendar
              ? undefined
              : {
                  value: sort,
                  onChange: (next) => setParams({ sort: next }),
                  options: EVENT_SORTS,
                }
          }
          columns={
            calendar ? undefined : (
              <ColumnPicker columns={COLUMNS} isShown={columns.isShown} onToggle={columns.toggle} />
            )
          }
        >
          {ownerFilter ? (
            <button
              type="button"
              onClick={() => {
                setAddress('ownerTeam', null);
              }}
              className="border-border-subtle bg-card text-secondary-foreground hover:bg-accent inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px]"
              aria-label={`Ekip süzgecini kaldır: ${ownerFilter}`}
            >
              Ekip: {ownerFilter}
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
          {viewSwitch}
        </ListToolbar>
      }
      footer={
        calendar ? undefined : (
          <ListFooter
            total={filtered.length}
            page={paged.page}
            totalPages={paged.totalPages}
            pageSize={PAGE_SIZE}
            onPage={(page) => setParams({ page })}
          />
        )
      }
    >
      {actionError ? (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      ) : null}
      {calendar ? (
        loading ? (
          <PageSkeleton variant="list" />
        ) : error ? (
          empty
        ) : (
          <EventCalendar events={filtered} onOpen={(id) => setParams({ panel: id })} />
        )
      ) : !loading && (error || filtered.length === 0) ? (
        empty
      ) : (
        <DataList
          columns={listColumns}
          rows={paged.slice}
          getRowId={(ev) => ev.id}
          onRowSelect={(ev) => setParams({ panel: ev.id })}
          rowLabel={(ev) => ev.name}
          rowClassName={(ev) => (ev.id === params.panel ? 'bg-accent/60' : undefined)}
          loading={loading}
          skeletonRows={6}
        />
      )}
      <SidePanel
        open={Boolean(openEvent)}
        title={openEvent?.name ?? ''}
        href={openEvent ? `/events/${openEvent.id}` : undefined}
        onPrev={open.prev ? () => setParams({ panel: open.prev }) : undefined}
        onNext={open.next ? () => setParams({ panel: open.next }) : undefined}
        onClose={() => setParams({ panel: null })}
      >
        {openEvent ? (
          <EventListPanel
            event={openEvent}
            stat={stats.get(openEvent.id)}
            canEdit={rightsFor(openEvent).canUpdate}
          />
        ) : null}
      </SidePanel>
      {statusActions.dialog}
      {copy.dialog}
    </ListPage>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <EventsPageContent />
    </Suspense>
  );
}
