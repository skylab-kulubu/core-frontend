'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { showIssueSection } from '@/components/scheduling/EventEditPage';
import { EventFormLayout } from '@/components/scheduling/EventFormLayout';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import { teamsApi } from '@/lib/api/teams';
import { useEventCreate } from '@/lib/use-event-create';
import { StateCard } from '@/components/chrome/StateCard';
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';
import { useNotify } from '@/lib/ui/use-notify';
import { coreProblemMessage, formInUseOf, type FormInUse } from '@/lib/core-problems';
import { eventFormIssue } from '@/lib/events-view';
import { formHandoffFromSearch } from '@/lib/event-forms';
import {
  clearEventDraft,
  ensureReservedEventId,
  restoreEventEditor,
  writeEventDraft,
} from '@/lib/event-draft';
import { useAuth } from '@/context/AuthContext';
import { eventFormChanged } from '@/lib/event-draft';
import { useUnsavedChanges } from '@/lib/ui/use-unsaved-changes';

function NewEventPageContent() {
  const router = useRouter();
  const notify = useNotify();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  // The group rule narrowed by core's event.create: a DK member creates nothing,
  // and one who leads a team creates for that team only
  const {
    canCreate,
    privilegedWriter: privileged,
    leaderTeams,
    ready: capabilitiesReady,
  } = useEventCreate(groups);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formInUse, setFormInUse] = useState<FormInUse | null>(null);
  const [form, setForm] = useState<EventFormState>(() =>
    emptyEventForm(privileged ? '' : (leaderTeams[0] ?? '')),
  );
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set once an earlier save created the Event but could not finish: the
  // next save updates it instead of creating another.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // What an untouched form holds, to tell typed work from none
  const blank = useRef<EventFormState | null>(null);
  const dirty = useMemo(
    () => ready && blank.current !== null && eventFormChanged(blank.current, form),
    [ready, form],
  );
  const guard = useUnsavedChanges(dirty && !saving, {
    // "Değişiklikleri sil" drops the kept draft too: the next visit starts empty
    onDiscard: () => {
      if (typeof window !== 'undefined') clearEventDraft(sessionStorage, window.location.href);
    },
  });

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
          setError(coreProblemMessage(err, 'Seçenekler yüklenemedi'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [privileged]);

  useEffect(() => {
    // Not before core's capabilities: until then a YK member who also leads a team
    // reads as a leader, and the draft would start with that team as owner
    if (typeof window === 'undefined' || !capabilitiesReady) return;
    const handoff = formHandoffFromSearch(searchParams);
    const empty = emptyEventForm(privileged ? '' : (leaderTeams[0] ?? ''));
    blank.current = empty;
    const restored = ensureReservedEventId(
      restoreEventEditor(sessionStorage, window.location.href, empty, handoff),
    );
    setForm(restored);
    persist(restored);
    setReady(true);
  }, [searchParams, privileged, capabilitiesReady]);

  if (!capabilitiesReady) return <StateCard title="Yükleniyor…" isLoading />;
  if (!canCreate) {
    return (
      <p className="text-destructive text-sm">
        Yeni etkinlik yalnızca ekip lideri veya YK içindir.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni etkinlik" />
      {!ready ? (
        <p className="text-subtle-foreground text-sm">Yükleniyor…</p>
      ) : (
        <EventFormLayout
          dirty={dirty}
          saving={saving}
          submitLabel="Oluştur"
          onCancel={() => guard.leave('/events')}
          error={error}
          extra={
            createdId ? (
              <p className="mb-2 text-sm">
                <Link href={`/events/${createdId}`} className="text-skylab-300 hover:underline">
                  Oluşturulan etkinliği aç
                </Link>
              </p>
            ) : null
          }
          onSubmit={async (e) => {
            e.preventDefault();
            const issue = eventFormIssue(form);
            if (issue) {
              setError(issue);
              showIssueSection(issue);
              return;
            }
            setSaving(true);
            setError(null);
            setFormInUse(null);
            try {
              const id = await saveEventWithSeason(form, createdId ?? undefined);
              if (typeof window !== 'undefined')
                clearEventDraft(sessionStorage, window.location.href);
              notify.success('Etkinlik oluşturuldu');
              guard.allowLeave();
              router.push(`/events/${id}`);
            } catch (err) {
              if (err instanceof EventSaveIncomplete) {
                setCreatedId(err.eventId);
                setError(
                  `Etkinlik oluşturuldu, ama kaydı tamamlanamadı: ${coreProblemMessage(err.cause, 'Kaydedilemedi')} Kaydet bu etkinliği günceller; yeni etkinlik açılmaz.`,
                );
              } else {
                setError(coreProblemMessage(err, 'Oluşturulamadı'));
                setFormInUse(formInUseOf(err));
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
            onLeaveToSkyforms={() => {
              // The draft comes back with the form: no question on the way out
              persist(form);
              guard.allowLeave();
            }}
            formInUse={formInUse}
          />
        </EventFormLayout>
      )}
      {guard.dialog}
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<p className="text-subtle-foreground text-sm">Yükleniyor…</p>}>
      <NewEventPageContent />
    </Suspense>
  );
}
