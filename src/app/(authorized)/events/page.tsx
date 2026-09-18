'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, List, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCalendar } from '@/components/scheduling/EventCalendar';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { canWriteEvent, isPrivileged, leaderOwnerTeams } from '@/lib/auth/groups';
import { eventListSubtitle, sortEventsForList } from '@/lib/events-view';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';
import { formHandoffFromSearch } from '@/lib/event-forms';

const PAGE_SIZE = 10;

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
    const q = query.trim().toLowerCase();
    const rows = sortEventsForList(events);
    if (!q) return rows;
    return rows.filter(
      (ev) =>
        ev.name.toLowerCase().includes(q) ||
        ev.ownerTeam.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q),
    );
  }, [events, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Etkinlikler"
        description={
          ownerFilter ? `Sahip ekip: ${ownerFilter}` : 'Liste veya takvim. Yeni etkinlik ekle.'
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 rounded-md border border-white/10 p-0.5">
              <button
                type="button"
                aria-pressed={!calendar}
                onClick={() => setView('list')}
                className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${
                  !calendar
                    ? 'bg-skylab-500/20 text-skylab-200'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Liste
              </button>
              <button
                type="button"
                aria-pressed={calendar}
                onClick={() => setView('calendar')}
                className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${
                  calendar
                    ? 'bg-skylab-500/20 text-skylab-200'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Takvim
              </button>
            </div>
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
      <Field
        placeholder="Ara"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
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
              emptyMessage: 'Etkinlik yok',
            })}
          >
            {slice.map((ev) => (
              <ListItem
                key={ev.id}
                href={`/events/${ev.id}`}
                title={ev.name}
                subtitle={eventListSubtitle(ev)}
              />
            ))}
          </ListPanel>
          <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
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
