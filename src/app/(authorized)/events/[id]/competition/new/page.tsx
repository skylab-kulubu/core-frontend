'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { PersonPick } from '@/components/identity/PersonPick';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { COMPETITOR_TAKEN, coreProblemMessage } from '@/lib/core-problems';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { canManageCompetitors } from '@/lib/auth/groups';
import { eventTabHref } from '@/lib/event-workspace';
import { useNotify } from '@/lib/ui/use-notify';

export default function NewCompetitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [userId, setUserId] = useState('');
  const [score, setScore] = useState('');
  const [isWinner, setIsWinner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();

  useEffect(() => {
    eventsApi
      .get(eventId)
      .then(setEvent)
      .catch((err) => setError(coreProblemMessage(err, 'Etkinlik yüklenemedi')));
  }, [eventId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni yarışmacı" description={event?.name} />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <form
        className="max-w-md space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!event || !canManageCompetitors(groups, event.ownerTeam) || !userId) {
            setError('Bu etkinliğe yarışmacı ekleyemezsin.');
            return;
          }
          const parsed = score.trim() === '' ? undefined : Number(score);
          try {
            await competitorsApi.create({ userId, eventId, score: parsed, isWinner });
            notify.success('Yarışmacı eklendi');
            router.push(eventTabHref(eventId, 'competition'));
          } catch (err) {
            setError(coreProblemMessage(err, 'Oluşturulamadı', COMPETITOR_TAKEN));
          }
        }}
      >
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
