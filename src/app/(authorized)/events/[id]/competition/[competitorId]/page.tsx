'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { PersonPick } from '@/components/identity/PersonPick';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { coreProblemMessage } from '@/lib/core-problems';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { canManageCompetitors } from '@/lib/auth/groups';
import { eventTabHref } from '@/lib/event-workspace';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

export default function EditCompetitorPage({
  params,
}: {
  params: Promise<{ id: string; competitorId: string }>;
}) {
  const { id: eventId, competitorId: id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const [row, setRow] = useState<Competitor | null>(null);
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [userId, setUserId] = useState('');
  const [score, setScore] = useState('');
  const [isWinner, setIsWinner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed save or delete keeps the form; `error` is for a competitor that cannot load
  const [saveError, setSaveError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    competitorsApi
      .get(id)
      .then(async (got) => {
        // A hand-written address with another event: open the competitor under its own event
        if (got.eventId !== eventId) {
          router.replace(`${eventTabHref(got.eventId, 'competition')}/${encodeURIComponent(id)}`);
          return;
        }
        setRow(got);
        setUserId(got.userId);
        setScore(got.score === undefined ? '' : String(got.score));
        setIsWinner(got.isWinner);
        const ev = await eventsApi.get(got.eventId).catch(() => null);
        setEvent(ev);
      })
      .catch((err) => setError(coreProblemMessage(err, 'Yüklenemedi')));
  }, [eventId, id]);

  const ownerTeam = event?.ownerTeam ?? '';
  const canManage = canManageCompetitors(groups, ownerTeam);
  const back = eventTabHref(eventId, 'competition');
  useChromeCrumbName(`/events/${eventId}`, event?.name);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!row) return <p className="text-subtle-foreground text-sm">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Yarışmacı" description={event?.name} />
      <form
        className="max-w-md space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canManage || !userId) return;
          const parsed = score.trim() === '' ? undefined : Number(score);
          setSaveError(null);
          try {
            await competitorsApi.update(id, {
              userId,
              eventId: row.eventId,
              score: parsed,
              isWinner,
            });
            notify.success('Yarışmacı kaydedildi');
            router.push(back);
          } catch (err) {
            setSaveError(coreProblemMessage(err, 'Güncellenemedi'));
          }
        }}
      >
        <PersonPick valueId={userId} onChange={setUserId} />
        <label className="block space-y-1">
          <FieldLabel>Puan</FieldLabel>
          <Field type="number" value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <Switch checked={isWinner} onChange={setIsWinner} label="Kazanan" />
        {saveError ? (
          <p role="alert" className="text-destructive text-sm">
            {saveError}
          </p>
        ) : null}
        {canManage ? (
          <div className="flex gap-2">
            <SaveButton>Kaydet</SaveButton>
            <button
              type="button"
              className="text-2xs border-border text-destructive h-8 rounded-md border px-3 font-medium"
              onClick={() => {
                // core deletes a competitor of any event but reinstates only in an active one
                const undoable = event?.active === true;
                confirm({
                  title: event?.name
                    ? `Yarışmacı ${event.name} yarışmasından silinsin mi?`
                    : 'Yarışmacı silinsin mi?',
                  description: undoable
                    ? `Yarışma listesinden kalkar. ${UNDO_HINT}`
                    : 'Yarışma listesinden kalkar. Etkinlik aktif olmadığı için geri alınamaz.',
                  actionLabel: 'Yarışmacıyı sil',
                  onConfirm: async () => {
                    await competitorsApi.delete(id);
                    if (undoable) {
                      notify.undoable(
                        'Yarışmacı silindi',
                        async () => {
                          await competitorsApi.reinstate(id);
                          router.push(`${back}/${encodeURIComponent(id)}`);
                        },
                        'Yarışmacı geri alındı',
                      );
                    } else {
                      notify.success('Yarışmacı silindi');
                    }
                    router.push(back);
                  },
                  failure: 'Yarışmacı silinemedi',
                });
              }}
            >
              Sil
            </button>
          </div>
        ) : null}
      </form>
      {confirmDialog}
    </div>
  );
}
