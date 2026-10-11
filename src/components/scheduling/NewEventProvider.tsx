'use client';

import { Button, Input, Textarea } from '@skylab-kulubu/skylcn-ui';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { Select } from '@/components/chrome/Select';
import { DatePicker } from '@/components/forms/DatePicker';
import { emptyEventForm, type EventFormState } from '@/components/scheduling/EventEditor';
import { useAuth } from '@/context/AuthContext';
import { teamsApi } from '@/lib/api/teams';
import { canWriteEvent, isPrivileged, leaderOwnerTeams } from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { ensureReservedEventId } from '@/lib/event-draft';
import { eventFormIssue } from '@/lib/events-view';
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';

const NewEventContext = createContext<{ open: () => void; canCreate: boolean }>({
  open: () => undefined,
  canCreate: false,
});

/** Opens the quick event form over the current page. */
export function useNewEvent() {
  return useContext(NewEventContext);
}

/**
 * Creating an Event without leaving the page: a side panel asks for what an
 * Event needs to exist, creates it and opens it, where its forms, photos and
 * season are added.
 */
export function NewEventProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const groups = useMemo(() => user?.groups ?? [], [user?.groups]);
  const privileged = isPrivileged(groups);
  const leaderTeams = useMemo(() => leaderOwnerTeams(groups), [groups]);
  const canCreate = privileged || leaderTeams.some((team) => canWriteEvent(groups, team, 'create'));
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open, canCreate }), [open, canCreate]);

  return (
    <NewEventContext.Provider value={value}>
      {children}
      {canCreate ? (
        <QuickEventDrawer
          open={isOpen}
          onClose={() => setOpen(false)}
          privileged={privileged}
          leaderTeams={leaderTeams}
        />
      ) : null}
    </NewEventContext.Provider>
  );
}

function QuickEventDrawer({
  open,
  onClose,
  privileged,
  leaderTeams,
}: {
  open: boolean;
  onClose: () => void;
  privileged: boolean;
  leaderTeams: string[];
}) {
  const router = useRouter();
  const id = useId();
  const fresh = useCallback(
    () => ensureReservedEventId(emptyEventForm(privileged ? '' : (leaderTeams[0] ?? ''))),
    [privileged, leaderTeams],
  );
  const [form, setForm] = useState<EventFormState>(fresh);
  const [teams, setTeams] = useState<string[]>(leaderTeams);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once a save created the Event but could not finish it: saving again updates it
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !privileged) return;
    let cancelled = false;
    teamsApi
      .list()
      .then((rows) => {
        if (!cancelled)
          setTeams([...new Set([...rows.map((row) => row.team), ...leaderTeams])].sort());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, privileged, leaderTeams]);

  const patch = (change: Partial<EventFormState>) =>
    setForm((current) => ({ ...current, ...change }));
  const close = () => {
    onClose();
    setError(null);
  };
  const locked = !privileged && leaderTeams.length === 1;

  return (
    <Drawer open={open} onClose={close} title="Yeni etkinlik">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (submit) => {
          submit.preventDefault();
          const issue = eventFormIssue(form);
          if (issue) {
            setError(issue);
            return;
          }
          setSaving(true);
          setError(null);
          try {
            const eventId = await saveEventWithSeason(form, createdId ?? undefined);
            setForm(fresh());
            setCreatedId(null);
            onClose();
            router.push(`/events/${eventId}`);
          } catch (err) {
            if (err instanceof EventSaveIncomplete) {
              setCreatedId(err.eventId);
              setError(
                `Etkinlik oluşturuldu ama kaydı tamamlanamadı: ${coreProblemMessage(err.cause, 'Kaydedilemedi')} Kaydet bu etkinliği günceller.`,
              );
            } else {
              setError(coreProblemMessage(err, 'Oluşturulamadı'));
            }
          } finally {
            setSaving(false);
          }
        }}
      >
        <p className="text-muted-foreground text-xs">
          Başvuru formu, görseller ve sezon etkinlik sayfasında eklenir.
        </p>
        <Row id={`${id}-name`} label="Ad">
          <Input
            id={`${id}-name`}
            value={form.name}
            onChange={(change) => patch({ name: change.target.value })}
            placeholder="Gece Kodu 2026"
            required
          />
        </Row>
        <Row id={`${id}-team`} label="Sahip ekip">
          <Select
            id={`${id}-team`}
            value={form.ownerTeam}
            disabled={locked}
            onChange={(change) => patch({ ownerTeam: change.target.value })}
          >
            {privileged ? <option value="">Ekip yok</option> : null}
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </Select>
        </Row>
        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="Başlangıç">
            <DatePicker
              aria-label="Başlangıç"
              value={form.startDate ?? ''}
              onChange={(startDate) => patch({ startDate })}
            />
          </Row>
          <Row label="Bitiş">
            <DatePicker
              aria-label="Bitiş"
              value={form.endDate ?? ''}
              onChange={(endDate) => patch({ endDate })}
            />
          </Row>
        </div>
        <Row id={`${id}-location`} label="Konum">
          <Input
            id={`${id}-location`}
            value={form.location}
            onChange={(change) => patch({ location: change.target.value })}
            placeholder="Davutpaşa Kongre Merkezi"
            required
          />
        </Row>
        <Row id={`${id}-capacity`} label="Kapasite" hint="Sınırsızsa 0">
          <Input
            id={`${id}-capacity`}
            type="number"
            min={0}
            inputMode="numeric"
            value={String(form.capacity)}
            onChange={(change) =>
              patch({ capacity: Math.max(0, Number(change.target.value) || 0) })
            }
          />
        </Row>
        <Row id={`${id}-description`} label="Açıklama" hint="İsteğe bağlı">
          <Textarea
            id={`${id}-description`}
            value={form.description}
            onChange={(change) => patch({ description: change.target.value })}
            rows={3}
          />
        </Row>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" pending={saving}>
            Oluştur ve aç
          </Button>
          <Button type="button" variant="ghost" onClick={close}>
            Vazgeç
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function Row({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {id ? (
        <label htmlFor={id} className="text-secondary-foreground text-xs">
          {label}
          {hint ? <span className="text-subtle-foreground"> · {hint}</span> : null}
        </label>
      ) : (
        <span className="text-secondary-foreground text-xs">{label}</span>
      )}
      {children}
    </div>
  );
}
