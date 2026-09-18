'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ProblemError } from '@/lib/api/core';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { teamsApi } from '@/lib/api/teams';
import { canWriteEvent, isPrivileged, leaderOwnerTeams } from '@/lib/auth/groups';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import { formHandoffFromSearch } from '@/lib/event-forms';
import { clearEventDraft, restoreEventEditor, writeEventDraft } from '@/lib/event-draft';
import { useAuth } from '@/context/AuthContext';

function NewEventPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const privileged = isPrivileged(groups);
  const leaderTeams = leaderOwnerTeams(groups);
  const canCreate = privileged || leaderTeams.some((team) => canWriteEvent(groups, team, 'create'));
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(() =>
    emptyEventForm(privileged ? '' : (leaderTeams[0] ?? '')),
  );
  const [ready, setReady] = useState(false);

  function persist(next: EventFormState) {
    if (typeof window === 'undefined') return;
    writeEventDraft(sessionStorage, window.location.href, next);
  }

  function updateForm(next: EventFormState) {
    setForm(next);
    persist(next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const teamRows = await teamsApi.list().catch(() => []);
        const fromTeams = teamRows.map((t) => t.team);
        const options = privileged
          ? [...new Set([...fromTeams, ...leaderTeams])]
          : leaderTeams.length
            ? leaderTeams
            : fromTeams;
        if (cancelled) return;
        setOwnerOptions(options);
        if (privileged) setSeasons(await seasonsApi.list().catch(() => []));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ProblemError ? err.title : 'Seçenekler yüklenemedi');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [privileged]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handoff = formHandoffFromSearch(searchParams);
    const restored = restoreEventEditor(
      sessionStorage,
      window.location.href,
      emptyEventForm(privileged ? '' : (leaderTeams[0] ?? '')),
      handoff,
    );
    setForm(restored);
    persist(restored);
    setReady(true);
  }, [searchParams, privileged]);

  if (!canCreate) {
    return (
      <p className="text-sm text-red-300">Yeni etkinlik yalnızca ekip lideri veya YK içindir.</p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni etkinlik"
        description="Kaydetmeden Skyforms’a gidilebilir; yazılanlar geri gelir."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {!ready ? (
        <p className="text-sm text-neutral-500">Yükleniyor…</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const id = await saveEventWithSeason(form);
              if (typeof window !== 'undefined')
                clearEventDraft(sessionStorage, window.location.href);
              router.push(`/events/${id}`);
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
            }
          }}
        >
          <EventEditor
            value={form}
            onChange={updateForm}
            ownerOptions={ownerOptions}
            lockOwner={!privileged && leaderTeams.length === 1}
            seasons={seasons}
            showSeason={privileged}
            ownerOptional={privileged}
            assignDoorStaff={privileged}
            returnTo={typeof window !== 'undefined' ? window.location.href : ''}
            onLeaveToSkyforms={() => persist(form)}
          />
          <SaveButton>Kaydet</SaveButton>
        </form>
      )}
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Yükleniyor…</p>}>
      <NewEventPageContent />
    </Suspense>
  );
}
