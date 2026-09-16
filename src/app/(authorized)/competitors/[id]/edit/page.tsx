'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Field } from '@/components/chrome/Field';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi, type Person } from '@/lib/api/identity';
import { canManageCompetitors } from '@/lib/auth/groups';

export default function EditCompetitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEventId = searchParams.get('eventId') ?? '';
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [row, setRow] = useState<Competitor | null>(null);
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [userId, setUserId] = useState('');
  const [score, setScore] = useState('');
  const [isWinner, setIsWinner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    competitorsApi
      .get(id)
      .then(async (got) => {
        setRow(got);
        setUserId(got.userId);
        setScore(got.score === undefined ? '' : String(got.score));
        setIsWinner(got.isWinner);
        const ev = await eventsApi.get(got.eventId).catch(() => null);
        setEvent(ev);
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Yüklenemedi'));
    identityApi
      .listUsers()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [id]);

  const ownerTeam = event?.ownerTeam ?? '';
  const canManage = canManageCompetitors(groups, ownerTeam);
  const back =
    queryEventId || row?.eventId ? `/events/${queryEventId || row?.eventId}` : '/competitors';

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!row) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Yarışmacı" description={event?.name} />
      <form
        className="max-w-md space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canManage) return;
          const parsed = score.trim() === '' ? undefined : Number(score);
          try {
            await competitorsApi.update(id, {
              userId,
              eventId: row.eventId,
              score: parsed,
              isWinner,
            });
            router.push(back);
          } catch (err) {
            setError(err instanceof ProblemError ? err.title : 'Güncellenemedi');
          }
        }}
      >
        {people.length > 0 ? (
          <select
            className="h-8 w-full rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.firstName} ${p.lastName}`.trim() || p.email}
              </option>
            ))}
          </select>
        ) : (
          <Field value={userId} onChange={(e) => setUserId(e.target.value)} required />
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
        {canManage ? (
          <div className="flex gap-2">
            <button
              type="submit"
              className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
            >
              Kaydet
            </button>
            <button
              type="button"
              className="text-2xs h-8 rounded-md border border-white/10 px-3 font-medium text-red-300"
              onClick={async () => {
                await competitorsApi.delete(id);
                router.push(back);
              }}
            >
              Sil
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
