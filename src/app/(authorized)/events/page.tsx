'use client';

import { useNewEvent } from '@/components/scheduling/NewEventProvider';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
} from '@skylab-kulubu/skylcn-ui';
import { Inbox, MoreHorizontal, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { SideScroll } from '@/components/chrome/SideScroll';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { StatusChip, StatusDot } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCalendar } from '@/components/scheduling/EventCalendar';
import {
  eventRowMenuItems,
  useEventStatusActions,
  useEventStatusRights,
} from '@/components/scheduling/use-event-status-actions';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { useEventCreate } from '@/lib/use-event-create';
import {
  countEventsByStatus,
  EVENT_STATUS_FILTERS,
  eventDisplayStatus,
  eventListSubtitle,
  eventStatusFilterFrom,
  filterEventsByStatus,
  sortEventsForList,
  type EventStatusFilter,
} from '@/lib/events-view';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';
import { formHandoffFromSearch } from '@/lib/event-forms';
import { SaveButton } from '@/components/chrome/SaveButton';

function EventsPageContent() {
  const router = useRouter();
  const { open: openNewEvent } = useNewEvent();
  const searchParams = useSearchParams();
  const ownerFilter = searchParams.get('ownerTeam')?.trim() || '';
  const calendar = searchParams.get('view') === 'calendar';
  const statusFilter = eventStatusFilterFrom(searchParams.get('status'));
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
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

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    const q = params.toString();
    router.replace(q ? `/events?${q}` : '/events');
  }

  function setView(next: 'list' | 'calendar') {
    setParam('view', next === 'calendar' ? 'calendar' : null);
  }

  async function load() {
    try {
      // Drafts too: core adds the ones the reader may see (their editors, DK)
      setEvents(await eventsApi.list(ownerFilter || undefined, undefined, { drafts: true }));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Etkinlikler yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ownerFilter]);

  useEffect(() => {
    setPage(1);
  }, [ownerFilter]);

  useEffect(() => {
    const handoff = formHandoffFromSearch(searchParams);
    if (!handoff) return;
    const next = new URLSearchParams(searchParams.toString());
    router.replace(`/events/new?${next.toString()}`);
  }, [searchParams, router]);

  const searched = useMemo(
    () => events.filter((ev) => matchesQuery(query, ev.name, ev.ownerTeam, ev.location)),
    [events, query],
  );
  const counts = useMemo(() => countEventsByStatus(searched), [searched]);
  const filtered = useMemo(
    () => filterEventsByStatus(sortEventsForList(searched), statusFilter),
    [searched, statusFilter],
  );
  const paged = paginateRows(filtered, page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Etkinlikler"
        description={
          ownerFilter ? `Sahip ekip: ${ownerFilter}` : 'Liste veya takvim. Yeni etkinlik ekle.'
        }
        actions={
          <div className="flex items-center gap-2">
            <FilterPills
              ariaLabel="Görünüm"
              value={calendar ? 'calendar' : 'list'}
              onChange={(next) => setView(next === 'calendar' ? 'calendar' : 'list')}
              options={[
                { value: 'list', label: 'Liste' },
                { value: 'calendar', label: 'Takvim' },
              ]}
            />
            {canCreate ? (
              <ActionButton
                icon={Plus}
                variant="primary"
                label="Etkinlik ekle"
                onClick={openNewEvent}
              />
            ) : null}
          </div>
        }
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {actionError ? (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Ad, ekip, konum"
        searchLabel="Etkinlik ara"
      >
        {/* Six counted pills do not fit a phone: they scroll sideways, the hidden side fades */}
        <SideScroll>
          <FilterPills<EventStatusFilter>
            ariaLabel="Etkinlik durumu"
            value={statusFilter}
            onChange={(value) => {
              setParam('status', value === 'all' ? null : value);
              setPage(1);
            }}
            options={EVENT_STATUS_FILTERS.map((row) => ({ ...row, count: counts[row.value] }))}
          />
        </SideScroll>
      </ListToolbar>
      {calendar ? (
        loading ? (
          <p className="text-subtle-foreground text-sm">Yükleniyor…</p>
        ) : (
          <EventCalendar events={filtered} />
        )
      ) : (
        <>
          <ListPanel
            status={listStatus({
              loading,
              failed: Boolean(error),
              rowCount: filtered.length,
              emptyMessage:
                statusFilter === 'draft' && !query
                  ? 'Taslak etkinlik yok'
                  : emptyListCopy({
                      none: 'Etkinlik yok',
                      noneMatch: 'Eşleşen etkinlik yok',
                      query,
                      filtered: statusFilter !== 'all',
                    }),
            })}
            emptyIcon={Inbox}
            emptyDescription={
              canCreate ? 'Yeni etkinlik ekle veya filtreyi temizle.' : 'Bu dilimde etkinlik yok.'
            }
            emptyAction={
              canCreate && !query && statusFilter === 'all' ? (
                <SaveButton type="button" onClick={openNewEvent}>
                  Etkinlik ekle
                </SaveButton>
              ) : null
            }
          >
            {paged.slice.map((ev) => {
              const status = eventDisplayStatus(ev);
              const menu = eventRowMenuItems(ev, rightsFor(ev), statusActions, {
                onDeleted: () => setEvents((rows) => rows.filter((row) => row.id !== ev.id)),
                onRestored: replaceEvent,
              });
              return (
                <ListItem
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  title={ev.name}
                  subtitle={eventListSubtitle(ev)}
                  leading={<StatusDot kind={status} />}
                  trailing={
                    <div className="flex items-center gap-1">
                      <StatusChip kind={status} />
                      {menu.length ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <IconButton
                                icon={MoreHorizontal}
                                size="icon-sm"
                                variant="ghost"
                                label={`${ev.name}: eylemler`}
                              />
                            }
                          />
                          <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </ListPanel>
          <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
        </>
      )}
      {statusActions.dialog}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<p className="text-subtle-foreground text-sm">Yükleniyor…</p>}>
      <EventsPageContent />
    </Suspense>
  );
}
