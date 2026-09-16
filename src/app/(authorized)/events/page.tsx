'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { teamsApi } from '@/lib/api/teams';
import { canWriteEvent, isPrivileged, leaderOwnerTeams } from '@/lib/auth/groups';
import { saveClass, saveEventWithSeason } from '@/lib/scheduling/save-event';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 10;

function EventsPageContent() {
  const searchParams = useSearchParams();
  const ownerFilter = searchParams.get('ownerTeam')?.trim() || '';
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<EventFormState>(emptyEventForm());
  const privileged = isPrivileged(groups);
  const leaderTeams = leaderOwnerTeams(groups);
  const canCreate = privileged || leaderTeams.some((team) => canWriteEvent(groups, team, 'create'));

  async function load() {
    try {
      const [rows, teamRows] = await Promise.all([
        eventsApi.list(ownerFilter || undefined),
        teamsApi.list().catch(() => []),
      ]);
      setEvents(rows);
      const fromTeams = teamRows.map((t) => t.team);
      const options = privileged
        ? [...new Set([...fromTeams, ...leaderTeams])]
        : leaderTeams.length
          ? leaderTeams
          : fromTeams;
      setOwnerOptions(options);
      setError(null);
      if (privileged) {
        setSeasons(await seasonsApi.list().catch(() => []));
      }
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, [ownerFilter]);

  useEffect(() => {
    setPage(1);
  }, [ownerFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
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
          ownerFilter ? `Sahip ekip: ${ownerFilter}` : 'Go API. Sahip ekip bir Group adıdır.'
        }
        actions={
          canCreate ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Etkinlik ekle"
              onClick={() => {
                setForm(emptyEventForm(privileged ? '' : (leaderTeams[0] ?? ownerFilter)));
                setCreating(true);
              }}
            />
          ) : undefined
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
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {slice.map((ev) => (
          <ListItem
            key={ev.id}
            href={`/events/${ev.id}`}
            title={ev.name}
            subtitle={`${ev.ownerTeam || 'Genel'}${ev.location ? ` · ${ev.location}` : ''}`}
          />
        ))}
      </div>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
      <Drawer open={creating} onClose={() => setCreating(false)} title="Etkinlik ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await saveEventWithSeason(form);
              setCreating(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
            }
          }}
        >
          <EventEditor
            value={form}
            onChange={setForm}
            ownerOptions={ownerOptions}
            lockOwner={!privileged && leaderTeams.length === 1}
            seasons={seasons}
            showSeason={privileged}
            ownerOptional={privileged}
          />
          <button type="submit" className={saveClass}>
            Kaydet
          </button>
        </form>
      </Drawer>
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
