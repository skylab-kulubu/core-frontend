'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventFormIssue } from '@/lib/events-view';
import { formHandoffFromSearch } from '@/lib/event-forms';
import {
  clearEventDraft,
  ensureReservedEventId,
  restoreEventEditor,
  writeEventDraft,
} from '@/lib/event-draft';
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
  const [saving, setSaving] = useState(false);
  // Set once an earlier save created the Event but could not finish: the
  // next save updates it instead of creating another.
  const [createdId, setCreatedId] = useState<string | null>(null);

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
    const restored = ensureReservedEventId(
      restoreEventEditor(
        sessionStorage,
        window.location.href,
        emptyEventForm(privileged ? '' : (leaderTeams[0] ?? '')),
        handoff,
      ),
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
      {!ready ? (
        <p className="text-sm text-neutral-500">Yükleniyor…</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const issue = eventFormIssue(form);
            if (issue) {
              setError(issue);
              return;
            }
            setSaving(true);
            setError(null);
            try {
              const id = await saveEventWithSeason(form, createdId ?? undefined);
              if (typeof window !== 'undefined')
                clearEventDraft(sessionStorage, window.location.href);
              router.push(`/events/${id}`);
            } catch (err) {
              if (err instanceof EventSaveIncomplete) {
                setCreatedId(err.eventId);
                setError(
                  `Etkinlik oluşturuldu, ama kaydı tamamlanamadı: ${coreProblemMessage(err.cause, 'Kaydedilemedi')} Kaydet bu etkinliği günceller; yeni etkinlik açılmaz.`,
                );
              } else {
                setError(coreProblemMessage(err, 'Oluşturulamadı'));
              }
            } finally {
              setSaving(false);
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
          {error ? (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {createdId ? (
            <p className="text-2xs text-neutral-400">
              <Link href={`/events/${createdId}`} className="text-skylab-300 hover:underline">
                Oluşturulan etkinliği aç
              </Link>
            </p>
          ) : null}
          <SaveButton disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</SaveButton>
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
