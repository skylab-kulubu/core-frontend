'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { Switch } from '@/components/chrome/Switch';
import { PersonPick } from '@/components/identity/PersonPick';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
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
          if (!event || !canManageCompetitors(groups, event.ownerTeam) || !userId) {
            setError('Bu etkinliğe yarışmacı ekleyemezsin.');
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
          <label className="block space-y-1">
            <FieldLabel>Etkinlik</FieldLabel>
            <Select value={eventId} onChange={(e) => setEventId(e.target.value)} required>
              <option value="">Seç</option>
              {writable.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <PersonPick valueId={userId} onChange={setUserId} />
        <label className="block space-y-1">
          <FieldLabel>Puan</FieldLabel>
          <Field type="number" value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <Switch checked={isWinner} onChange={setIsWinner} label="Kazanan" />
        <SaveButton>Kaydet</SaveButton>
      </form>
    </div>
  );
}
