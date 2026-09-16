'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Field } from '@/components/chrome/Field';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi, type Person } from '@/lib/api/identity';
import { canManageCompetitors } from '@/lib/auth/groups';

export default function NewCompetitorPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Yükleniyor…</p>}>
      <NewCompetitorForm />
    </Suspense>
  );
}

function NewCompetitorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lockedEventId = searchParams.get('eventId') || '';
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [userId, setUserId] = useState('');
  const [eventId, setEventId] = useState(lockedEventId);
  const [score, setScore] = useState('');
  const [isWinner, setIsWinner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    eventsApi
      .list()
      .then(setEvents)
      .catch((err) =>
        setError(err instanceof ProblemError ? err.title : 'Etkinlikler yüklenemedi'),
      );
    identityApi
      .listUsers()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);

  const writable = events.filter((e) => canManageCompetitors(groups, e.ownerTeam));

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni yarışmacı" />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <form
        className="max-w-md space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const event = events.find((ev) => ev.id === eventId);
          if (!event || !canManageCompetitors(groups, event.ownerTeam)) {
            setError('Forbidden');
            return;
          }
          const parsed = score.trim() === '' ? undefined : Number(score);
          try {
            await competitorsApi.create({ userId, eventId, score: parsed, isWinner });
            router.push(lockedEventId ? `/events/${lockedEventId}` : '/competitors');
          } catch (err) {
            setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
          }
        }}
      >
        {lockedEventId ? (
          <p className="text-sm text-neutral-400">
            {events.find((e) => e.id === lockedEventId)?.name ?? lockedEventId}
          </p>
        ) : (
          <select
            className="h-8 w-full rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
          >
            <option value="">Etkinlik</option>
            {writable.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        )}
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
    </div>
  );
}
