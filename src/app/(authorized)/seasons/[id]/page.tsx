'use client';

import { Link2, Pencil, RefreshCw } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectPage, ObjectPageHeader } from '@/components/chrome/object-page/ObjectPage';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { EmptyState, NotFoundState } from '@/components/chrome/PageState';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import type { EventStat } from '@/lib/api/dashboard';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { canWriteSeason } from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { formatEventWhen } from '@/lib/events-view';
import { matchesQuery } from '@/lib/list-query';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCan } from '@/lib/use-app-can';
import { SeasonEvents } from '../_parts/SeasonEvents';
import { SeasonOverview } from '../_parts/SeasonOverview';
import { SeasonSettings } from '../_parts/SeasonSettings';
import { seasonHref, seasonRange, seasonSection, type SeasonSection } from '../_parts/season-view';

const SECTION_LABELS: Record<SeasonSection, string> = {
  genel: 'Genel bakış',
  etkinlikler: 'Etkinlikler',
  ayarlar: 'Ayarlar',
};

type Load =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; season: Season; events: CoreEvent[] };

/**
 * A season's own page (an object page): Genel bakış with its figures and charts,
 * Etkinlikler with the events linked to it, and Ayarlar.
 */
export default function SeasonPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const search = useSearchParams();
  const section = seasonSection(search?.get('bolum') ?? null);
  const router = useRouter();
  const { user } = useAuth();
  const canWrite = useAppCan(canWriteSeason(user?.groups ?? []))('season.write');
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [stats, setStats] = useState<EventStat[] | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  // "Etkinlik bağla": the club's events, read when the picker opens
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<CoreEvent[] | null>(null);
  const [candidatesFailed, setCandidatesFailed] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [season, events] = await Promise.all([seasonsApi.get(id), seasonsApi.listEvents(id)]);
      setState({ kind: 'ready', season, events });
    } catch (error) {
      setState(
        error instanceof ProblemError && error.status === 404
          ? { kind: 'missing' }
          : { kind: 'failed', message: coreProblemMessage(error, 'Sezon yüklenemedi') },
      );
    }
    // The applications and entries: whoever may not read them sees the season without them
    eventsApi
      .stats()
      .then((answer) => setStats(answer.eventStats))
      .catch(() => setStats(null));
  }, [id]);

  useEffect(() => {
    setNow(new Date());
    void load();
  }, [load]);

  useEffect(() => {
    if (!picking || candidates !== null) return;
    eventsApi
      .list(undefined, 'all')
      .then((rows) => {
        setCandidates(rows);
        setCandidatesFailed(false);
      })
      .catch(() => setCandidatesFailed(true));
  }, [picking, candidates]);

  const season = state.kind === 'ready' ? state.season : null;
  const events = useMemo(() => (state.kind === 'ready' ? state.events : []), [state]);
  useChromeCrumbName(seasonHref(id), season?.name);

  if (state.kind === 'missing') return <NotFoundState />;
  if (state.kind === 'failed') {
    return (
      <div className="space-y-6">
        <PageHeader title="Sezon" />
        <EmptyState kind="failed" title={state.message} onRetry={() => void load()} />
      </div>
    );
  }
  if (!season || !now) return <PageSkeleton variant="detail" />;

  const go = (next: SeasonSection) => router.push(seasonHref(season.id, next));
  const linked = new Set(events.map((event) => event.id));
  const options = (candidates ?? [])
    .filter((event) => !linked.has(event.id) && matchesQuery(query, event.name, event.ownerTeam))
    .map((event) => ({
      id: event.id,
      title: event.name,
      subtitle: [formatEventWhen(event), event.ownerTeam].filter(Boolean).join(' · '),
      marker: event.seasonId ? 'Başka sezonda' : undefined,
    }));

  async function assign(eventId: string) {
    if (!season) return;
    setPickError(null);
    try {
      await seasonsApi.assignEvent(season.id, eventId);
      notify.success('Etkinlik sezona bağlandı');
      setPicking(false);
      setQuery('');
      setCandidates(null);
      await load();
    } catch (error) {
      setPickError(coreProblemMessage(error, 'Etkinlik bağlanamadı'));
    }
  }

  function unassign(event: CoreEvent) {
    confirm({
      title: `"${event.name}" sezondan çıkarılsın mı?`,
      description: 'Etkinlik kalır; yalnız bu sezonla bağı kopar.',
      actionLabel: 'Sezondan çıkar',
      onConfirm: async () => {
        await seasonsApi.unassignEvent(event.id);
        notify.success('Etkinlik sezondan çıkarıldı');
        await load();
      },
      failure: 'Etkinlik çıkarılamadı',
    });
  }

  async function remove() {
    if (!season) return;
    const seasonId = season.id;
    await seasonsApi.delete(seasonId);
    notify.undoable(
      'Sezon silindi',
      async () => {
        await seasonsApi.restore(seasonId);
        router.push(seasonHref(seasonId));
      },
      'Sezon geri alındı',
    );
    router.push('/seasons');
  }

  const openPicker = () => {
    setPickError(null);
    setPicking(true);
  };
  const menuItem = (key: SeasonSection, badge?: number) => ({
    href: seasonHref(season.id, key),
    label: SECTION_LABELS[key],
    badge,
  });

  return (
    <ObjectPage
      header={
        <ObjectPageHeader
          eyebrow="Sezon"
          title={season.name}
          section={section !== 'genel' ? SECTION_LABELS[section] : undefined}
          badges={
            season.active ? (
              <StatusChip kind="active" />
            ) : (
              <StatusChip kind="neutral" label="Pasif" />
            )
          }
          meta={seasonRange(season) || undefined}
        />
      }
      commands={
        <CommandBar label="Sezon komutları">
          {canWrite ? (
            <Command primary icon={Link2} label="Etkinlik bağla" onClick={openPicker} />
          ) : null}
          {canWrite && section !== 'ayarlar' ? (
            <Command icon={Pencil} label="Düzenle" href={seasonHref(season.id, 'ayarlar')} />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      menu={{
        label: 'Sezon',
        sections: [
          {
            items: [
              menuItem('genel'),
              menuItem('etkinlikler', events.length),
              ...(canWrite ? [menuItem('ayarlar')] : []),
            ],
          },
        ],
        activeHref: seasonHref(season.id, section),
      }}
    >
      {section === 'etkinlikler' ? (
        <SeasonEvents
          events={events}
          stats={stats}
          canEdit={canWrite}
          onUnassign={unassign}
          addAction={
            canWrite ? (
              <ActionButton
                icon={Link2}
                variant="primary"
                label="Etkinlik bağla"
                onClick={openPicker}
              />
            ) : undefined
          }
        />
      ) : section === 'ayarlar' && canWrite ? (
        <SeasonSettings
          key={season.updatedAt}
          season={season}
          onSaved={(updated) => {
            setState({ kind: 'ready', season: updated, events });
            notify.success('Sezon kaydedildi');
          }}
          onDelete={remove}
        />
      ) : (
        <SeasonOverview
          season={season}
          events={events}
          stats={stats}
          canEdit={canWrite}
          now={now}
          onOpenEvents={() => go('etkinlikler')}
        />
      )}
      <PickerDrawer
        open={picking}
        onClose={() => setPicking(false)}
        title="Etkinlik bağla"
        query={query}
        onQuery={setQuery}
        placeholder="Etkinlik adı ya da ekip"
        loading={picking && candidates === null && !candidatesFailed}
        failed={candidatesFailed}
        options={options}
        emptyMessage="Bağlanacak etkinlik yok"
        onPick={(eventId) => void assign(eventId)}
        error={pickError}
      />
      {confirmDialog}
    </ObjectPage>
  );
}
