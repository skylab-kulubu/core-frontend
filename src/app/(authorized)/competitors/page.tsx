'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi, type Person } from '@/lib/api/identity';
import { canManageCompetitors, isPrivileged } from '@/lib/auth/groups';
import { listStatus } from '@/lib/list-status';

const PAGE_SIZE = 10;

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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yarışmacılar"
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
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: rows.length,
          emptyMessage: 'Yarışmacı yok',
        })}
      >
        {slice.map((row) => {
          const person = personById.get(row.userId);
          const event = eventById.get(row.eventId);
          const name = person
            ? `${person.firstName} ${person.lastName}`.trim() || person.email
            : row.userId;
          return (
            <ListItem
              key={row.id}
              href={`/competitors/${row.id}/edit`}
              title={name}
              subtitle={`${event?.name ?? row.eventId}${row.isWinner ? ' · kazanan' : ''}`}
            />
          );
        })}
      </ListPanel>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
      <Drawer open={creating} onClose={() => setCreating(false)} title="Yarışmacı ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const event = eventById.get(eventId);
            if (!event || !canManageCompetitors(groups, event.ownerTeam)) return;
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
          <select
            className="h-8 w-full rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
          >
            <option value="">Etkinlik</option>
            {writableEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
          {people.length > 0 ? (
            <select
              className="h-8 w-full rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            >
              <option value="">Kullanıcı</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.firstName} ${p.lastName}`.trim() || p.email}
                </option>
              ))}
            </select>
          ) : (
            <Field
              placeholder="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          )}
          <Field
            placeholder="Puan"
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={isWinner}
              onChange={(e) => setIsWinner(e.target.checked)}
            />
            Kazanan
          </label>
          <button
            type="submit"
            className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
          >
            Kaydet
          </button>
        </form>
      </Drawer>
    </div>
  );
}
