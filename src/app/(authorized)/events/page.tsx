'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Inbox, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { StatusChip, StatusDot } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCalendar } from '@/components/scheduling/EventCalendar';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { canWriteEvent, isPrivileged, leaderOwnerTeams } from '@/lib/auth/groups';
import {
  eventListSubtitle,
  filterEventsByPhase,
  sortEventsForList,
  type EventPhaseFilter,
} from '@/lib/events-view';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';
import { formHandoffFromSearch } from '@/lib/event-forms';
import { activeStatus } from '@/lib/status-chip';
import { SaveButton } from '@/components/chrome/SaveButton';

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ownerFilter = searchParams.get('ownerTeam')?.trim() || '';
  const calendar = searchParams.get('view') === 'calendar';
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<EventPhaseFilter>('all');
  const privileged = isPrivileged(groups);
  const leaderTeams = leaderOwnerTeams(groups);
  const canCreate = privileged || leaderTeams.some((team) => canWriteEvent(groups, team, 'create'));

  function setView(next: 'list' | 'calendar') {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'calendar') params.set('view', 'calendar');
    else params.delete('view');
    const q = params.toString();
    router.replace(q ? `/events?${q}` : '/events');
  }

  async function load() {
    try {
      setEvents(await eventsApi.list(ownerFilter || undefined));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi');
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

  const filtered = useMemo(() => {
    const rows = filterEventsByPhase(sortEventsForList(events), phase);
    return rows.filter((ev) => matchesQuery(query, ev.name, ev.ownerTeam, ev.location));
  }, [events, query, phase]);
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
                onClick={() => router.push('/events/new')}
              />
            ) : null}
          </div>
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Ad, ekip, konum"
        searchLabel="Etkinlik ara"
      >
        <FilterPills
          ariaLabel="Etkinlik dilimi"
          value={phase}
          onChange={(value) => {
            setPhase(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'upcoming', label: 'Yaklaşan' },
            { value: 'active', label: 'Aktif' },
            { value: 'past', label: 'Geçmiş' },
          ]}
        />
      </ListToolbar>
      {calendar ? (
        loading ? (
          <p className="text-sm text-neutral-500">Yükleniyor…</p>
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
              emptyMessage: emptyListCopy({
                none: 'Etkinlik yok',
                noneMatch: 'Eşleşen etkinlik yok',
                query,
                filtered: phase !== 'all',
              }),
            })}
            emptyIcon={Inbox}
            emptyDescription={
              canCreate ? 'Yeni etkinlik ekle veya filtreyi temizle.' : 'Bu dilimde etkinlik yok.'
            }
            emptyAction={
              canCreate && !query && phase === 'all' ? (
                <SaveButton type="button" onClick={() => router.push('/events/new')}>
                  Etkinlik ekle
                </SaveButton>
              ) : null
            }
          >
            {paged.slice.map((ev) => (
              <ListItem
                key={ev.id}
                href={`/events/${ev.id}`}
                title={ev.name}
                subtitle={eventListSubtitle(ev)}
                leading={<StatusDot kind={activeStatus(ev.active)} />}
                trailing={<StatusChip kind={activeStatus(ev.active)} />}
              />
            ))}
          </ListPanel>
          <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Yükleniyor…</p>}>
      <EventsPageContent />
    </Suspense>
  );
}
