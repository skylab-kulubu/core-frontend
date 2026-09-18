'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { Pagination } from '@/components/chrome/Pagination';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { Switch } from '@/components/chrome/Switch';
import { PersonPick, personLabel } from '@/components/identity/PersonPick';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi, type Person } from '@/lib/api/identity';
import { canManageCompetitors, isPrivileged } from '@/lib/auth/groups';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';

export default function CompetitorsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [rows, setRows] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [winnerOnly, setWinnerOnly] = useState<'all' | 'winner'>('all');
  const [userId, setUserId] = useState('');
  const [eventId, setEventId] = useState('');
  const [score, setScore] = useState('');
  const [isWinner, setIsWinner] = useState(false);

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const writableEvents = events.filter((e) => canManageCompetitors(groups, e.ownerTeam));
  const canCreate = writableEvents.length > 0 || isPrivileged(groups);

  async function load() {
    try {
      const [comps, eventRows] = await Promise.all([competitorsApi.list(), eventsApi.list()]);
      setEvents(eventRows);
      const allowedIds = new Set(
        eventRows.filter((e) => canManageCompetitors(groups, e.ownerTeam)).map((e) => e.id),
      );
      setRows(isPrivileged(groups) ? comps : comps.filter((c) => allowedIds.has(c.eventId)));
      setPeople(await identityApi.listUsers().catch(() => []));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Yarışmacılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.id]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (winnerOnly === 'winner' && !row.isWinner) return false;
      const person = personById.get(row.userId);
      const event = eventById.get(row.eventId);
      return matchesQuery(
        query,
        person ? personLabel(person) : row.userId,
        event?.name,
        row.eventId,
      );
    });
  }, [rows, query, winnerOnly, personById, eventById]);
  const paged = paginateRows(filtered, page);

  useEffect(() => {
    setPage(1);
  }, [query, winnerOnly]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yarışmacılar"
        description="Etkinliğe kişi bağla, puan ve kazananı işaretle."
        actions={
          canCreate ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Yarışmacı ekle"
              onClick={() => setCreating(true)}
            />
          ) : undefined
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Kişi veya etkinlik"
        searchLabel="Yarışmacı ara"
      >
        <FilterPills
          ariaLabel="Kazanan dilimi"
          value={winnerOnly}
          onChange={setWinnerOnly}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'winner', label: 'Kazanan' },
          ]}
        />
      </ListToolbar>
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Yarışmacı yok',
            noneMatch: 'Eşleşen yarışmacı yok',
            query,
            filtered: winnerOnly !== 'all',
          }),
        })}
        emptyDescription="Etkinliğe kişi bağla."
      >
        {paged.slice.map((row) => {
          const person = personById.get(row.userId);
          const event = eventById.get(row.eventId);
          const name = person ? personLabel(person) : row.userId;
          return (
            <ListItem
              key={row.id}
              href={`/competitors/${row.id}/edit`}
              title={name}
              subtitle={`${event?.name ?? row.eventId}${row.score !== undefined ? ` · ${row.score}` : ''}`}
              trailing={row.isWinner ? <StatusChip kind="winner" /> : undefined}
            />
          );
        })}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
      <Drawer open={creating} onClose={() => setCreating(false)} title="Yarışmacı ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const event = eventById.get(eventId);
            if (!event || !canManageCompetitors(groups, event.ownerTeam) || !userId) return;
            const parsed = score.trim() === '' ? undefined : Number(score);
            await competitorsApi.create({
              userId,
              eventId,
              score: parsed,
              isWinner,
            });
            setCreating(false);
            setUserId('');
            setEventId('');
            setScore('');
            setIsWinner(false);
            await load();
          }}
        >
          <label className="block space-y-1">
            <FieldLabel>Etkinlik</FieldLabel>
            <Select value={eventId} onChange={(e) => setEventId(e.target.value)} required>
              <option value="">Seç</option>
              {writableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
          </label>
          <PersonPick valueId={userId} onChange={setUserId} />
          <label className="block space-y-1">
            <FieldLabel>Puan</FieldLabel>
            <Field type="number" value={score} onChange={(e) => setScore(e.target.value)} />
          </label>
          <Switch checked={isWinner} onChange={setIsWinner} label="Kazanan" />
          <SaveButton>Kaydet</SaveButton>
        </form>
      </Drawer>
    </div>
  );
}
