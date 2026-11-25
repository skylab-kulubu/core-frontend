'use client';

import { Button, Skeleton } from '@skylab-kulubu/skylcn-ui';
import { Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { LoadError } from '@/components/chrome/LoadError';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { PERSON_SEARCH_HINT, usePersonSearch } from '@/components/identity/use-person-search';
import { ProblemError } from '@/lib/api/core';
import type { CoreEvent } from '@/lib/api/events';
import {
  eventOrganizersApi,
  type EventOrganizerPerson,
  type EventOrganizers as Organizers,
  type EventOrganizerTeam,
  type OrganizerManagement,
  type OrganizerVisibility,
} from '@/lib/api/event-organizers';
import { teamsApi, type PublicTeam } from '@/lib/api/teams';
import { coreProblemMessage } from '@/lib/core-problems';
import {
  MANAGEMENT_LABELS,
  ORGANIZER_LIMIT,
  PRIVILEGED_TEAMS,
  VISIBILITY_HINTS,
  VISIBILITY_LABELS,
  organizersProblemMessage,
  personExpiry,
  personExpiryLine,
} from '@/lib/event-organizers';
import { listStatus } from '@/lib/list-status';
import { pickerMatch } from '@/lib/picker';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useNotify } from '@/lib/ui/use-notify';
import { useUnsavedChanges } from '@/lib/ui/use-unsaved-changes';

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; organizers: Organizers }
  /** An older core without Co-organizers (404). */
  | { status: 'absent' }
  | { status: 'failed'; error: string };

type Draft = { teams: EventOrganizerTeam[]; people: EventOrganizerPerson[] };

const sameDraft = (a: Draft, b: Draft) =>
  JSON.stringify([a.teams, a.people.map((p) => p.id)]) ===
  JSON.stringify([b.teams, b.people.map((p) => p.id)]);

function teamName(team: PublicTeam): string {
  const shown = team.displayName?.tr?.trim();
  return shown && shown !== team.team ? `${team.team} · ${shown}` : team.team;
}

/**
 * Düzenleyenler (core docs/co-organizers.md): the Co-organizer teams, each
 * with who of it manages the Event and whether it is named outside the panel,
 * and the Co-organizer people. Saved apart from the Event (PUT …/organizers).
 * Who may not change the list (a Co-organizer, or while core's switch is off)
 * reads it; with nothing on it they see one line.
 */
export function EventOrganizers({
  event,
}: {
  event: Pick<CoreEvent, 'id' | 'ownerTeam' | 'startDate' | 'endDate'>;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [draft, setDraft] = useState<Draft>({ teams: [], people: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [teams, setTeams] = useState<PublicTeam[] | null>(null);
  const [teamsFailed, setTeamsFailed] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [personQuery, setPersonQuery] = useState('');
  const personSearch = usePersonSearch(personOpen, personQuery);
  const notify = useNotify();

  const read = useCallback(async () => {
    try {
      const organizers = await eventOrganizersApi.get(event.id);
      setLoaded({ status: 'ready', organizers });
      setDraft({ teams: organizers.teams, people: organizers.people });
    } catch (cause) {
      setLoaded(
        cause instanceof ProblemError && cause.status === 404
          ? { status: 'absent' }
          : { status: 'failed', error: coreProblemMessage(cause, 'Düzenleyenler yüklenemedi') },
      );
    }
  }, [event.id]);

  useEffect(() => {
    void read();
  }, [read]);

  useEffect(() => {
    if (!teamOpen || teams) return;
    let cancelled = false;
    teamsApi
      .list()
      .then((rows) => {
        if (!cancelled) setTeams(rows);
      })
      .catch(() => {
        if (!cancelled) setTeamsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [teamOpen, teams]);

  const saved =
    loaded.status === 'ready'
      ? { teams: loaded.organizers.teams, people: loaded.organizers.people }
      : draft;
  const dirty = loaded.status === 'ready' && !sameDraft(draft, saved);
  const guard = useUnsavedChanges(dirty && !saving);

  const teamOptions = useMemo(() => {
    const taken = new Set(draft.teams.map((row) => row.code));
    return (teams ?? [])
      .filter(
        (team) =>
          team.team !== event.ownerTeam &&
          !PRIVILEGED_TEAMS.has(team.team) &&
          !taken.has(team.team) &&
          pickerMatch(teamQuery, team.team, team.displayName?.tr),
      )
      .map((team) => ({ id: team.team, title: teamName(team) }));
  }, [teams, draft.teams, event.ownerTeam, teamQuery]);

  if (loaded.status === 'loading') return <Skeleton className="h-24 w-full" />;
  if (loaded.status === 'absent') {
    return (
      <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Ortak düzenleyen bu sunucuda yok</p>
    );
  }
  if (loaded.status === 'failed') {
    return <LoadError title={loaded.error} onRetry={() => read()} />;
  }

  const { organizers } = loaded;
  const canManage = organizers.canManage;
  const ownerRule = organizers.ownerRule;
  const expiry = personExpiry(event);

  const patchTeam = (code: string, partial: Partial<EventOrganizerTeam>) =>
    setDraft((current) => ({
      ...current,
      teams: current.teams.map((row) => (row.code === code ? { ...row, ...partial } : row)),
    }));

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const next = await eventOrganizersApi.put(event.id, {
        teams: draft.teams.map(({ code, management, visibility }) => ({
          code,
          management,
          visibility,
        })),
        people: draft.people.map((person) => person.id),
      });
      setLoaded({ status: 'ready', organizers: next });
      setDraft({ teams: next.teams, people: next.people });
      notify.success('Düzenleyenler kaydedildi');
    } catch (cause) {
      setError(
        organizersProblemMessage(cause, (field, index) =>
          field === 'teams' ? draft.teams[index]?.code : draft.people[index]?.name,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const ownerLine = (
    <p className="text-secondary-foreground text-sm">
      Sahip ekip: <span className="text-foreground">{organizers.ownerTeam || 'Yok'}</span>
    </p>
  );

  // Read-only: a Co-organizer, an editor who is no Owner team Leader, or core's switch off
  if (!canManage) {
    if (draft.teams.length === 0 && draft.people.length === 0) {
      return (
        <div className="space-y-1">
          {ownerLine}
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Ortak düzenleyen yok</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {ownerLine}
        {draft.teams.length ? (
          <div className="space-y-1">
            <FieldLabel>Ortak ekipler</FieldLabel>
            <ListPanel
              status={listStatus({
                loading: false,
                rowCount: draft.teams.length,
                emptyMessage: '',
              })}
            >
              {draft.teams.map((row) => (
                <ListItem
                  key={row.code}
                  title={row.name || row.code}
                  subtitle={`${MANAGEMENT_LABELS[row.management]} · ${VISIBILITY_LABELS[row.visibility]}`}
                />
              ))}
            </ListPanel>
          </div>
        ) : null}
        {draft.people.length ? (
          <div className="space-y-1">
            <FieldLabel>Ortak kişiler</FieldLabel>
            <ListPanel
              status={listStatus({
                loading: false,
                rowCount: draft.people.length,
                emptyMessage: '',
              })}
            >
              {draft.people.map((person) => (
                <ListItem
                  key={person.id}
                  title={person.name}
                  subtitle={personExpiryLine(person.expiresAt)}
                />
              ))}
            </ListPanel>
          </div>
        ) : null}
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          Listeyi sahip ekibin liderleri değiştirir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {ownerLine}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Ortak ekipler</FieldLabel>
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Ekip ekle"
            disabled={draft.teams.length >= ORGANIZER_LIMIT}
            onClick={() => {
              setTeamQuery('');
              setTeamOpen(true);
            }}
          />
        </div>
        {draft.teams.length === 0 ? (
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Ortak ekip yok</p>
        ) : (
          <ul className="space-y-2">
            {draft.teams.map((row) => (
              <li key={row.code} className="border-border-subtle space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground min-w-0 truncate text-sm">
                    {row.name || row.code}
                  </span>
                  <ActionButton
                    icon={X}
                    label={`${row.code} ekibini çıkar`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        teams: current.teams.filter((item) => item.code !== row.code),
                      }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <FieldLabel>Kim yönetir</FieldLabel>
                    <Select
                      value={row.management}
                      onChange={(e) =>
                        patchTeam(row.code, { management: e.target.value as OrganizerManagement })
                      }
                    >
                      {(['leaders', 'members'] as const).map((value) => (
                        <option key={value} value={value}>
                          {MANAGEMENT_LABELS[value]}
                          {value === ownerRule ? ' (sahip ekip gibi)' : ''}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="space-y-1">
                    <label className="block space-y-1">
                      <FieldLabel>Görünüm</FieldLabel>
                      <Select
                        value={row.visibility}
                        onChange={(e) =>
                          patchTeam(row.code, {
                            visibility: e.target.value as OrganizerVisibility,
                          })
                        }
                      >
                        {(['co_organizer', 'helper'] as const).map((value) => (
                          <option key={value} value={value}>
                            {VISIBILITY_LABELS[value]}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                      {VISIBILITY_HINTS[row.visibility]}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Ortak kişiler</FieldLabel>
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Kişi ekle"
            disabled={draft.people.length >= ORGANIZER_LIMIT}
            onClick={() => {
              setPersonQuery('');
              setPersonOpen(true);
            }}
          />
        </div>
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          Ekibi varsa ekibi ekleyin. Kişiler dışarıda görünmez.
        </p>
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: draft.people.length,
            emptyMessage: 'Ortak kişi yok',
          })}
        >
          {draft.people.map((person) => (
            <ListItem
              key={person.id}
              title={person.name}
              subtitle={personExpiryLine(person.expiresAt ?? expiry)}
              trailing={
                <ActionButton
                  icon={X}
                  label={`${person.name} kişisini çıkar`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      people: current.people.filter((item) => item.id !== person.id),
                    }))
                  }
                />
              }
            />
          ))}
        </ListPanel>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton type="button" disabled={saving} onClick={() => void save()}>
            Düzenleyenleri kaydet
          </SaveButton>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setDraft(saved);
              setError(undefined);
            }}
          >
            Vazgeç
          </Button>
          <span className={`text-warning ${TEXT_SECONDARY}`}>
            Etkinliğin Kaydet düğmesi bunları kaydetmez.
          </span>
        </div>
      ) : null}

      <PickerDrawer
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title="Ortak ekip ekle"
        query={teamQuery}
        onQuery={setTeamQuery}
        placeholder="Ekip"
        loading={!teams && !teamsFailed}
        failed={teamsFailed}
        options={teamOptions}
        emptyMessage="Eklenecek ekip yok"
        onPick={(code) => {
          const team = teams?.find((row) => row.team === code);
          setDraft((current) => ({
            ...current,
            teams: [
              ...current.teams,
              {
                code,
                name: team ? teamName(team) : code,
                management: ownerRule,
                visibility: 'co_organizer',
              },
            ],
          }));
          setTeamOpen(false);
        }}
      />
      <PickerDrawer
        open={personOpen}
        onClose={() => setPersonOpen(false)}
        title="Ortak kişi ekle"
        query={personQuery}
        onQuery={setPersonQuery}
        placeholder="Ad, e-posta"
        loading={personSearch.loading}
        failed={personSearch.failed}
        options={personSearch.people
          .filter(
            (person) =>
              !draft.people.some((row) => row.id === person.id) &&
              pickerMatch(personQuery, person.email, person.firstName, person.lastName),
          )
          .map((person) => ({
            id: person.id,
            title: `${person.firstName} ${person.lastName}`.trim() || person.email,
            subtitle: person.email,
          }))}
        emptyMessage={personSearch.ready ? 'Kullanıcı yok' : PERSON_SEARCH_HINT}
        onPick={(id) => {
          const person = personSearch.people.find((row) => row.id === id);
          if (!person) return;
          setDraft((current) => ({
            ...current,
            people: [
              ...current.people,
              {
                id,
                name: `${person.firstName} ${person.lastName}`.trim() || person.email,
                email: person.email,
              },
            ],
          }));
          setPersonOpen(false);
        }}
      />
      {guard.dialog}
    </div>
  );
}
