'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useRouter } from 'next/navigation';
import { Mail, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { EventWorkspaceNav } from '@/components/scheduling/EventWorkspaceNav';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi, type Competitor } from '@/lib/api/competitors';
import { eventDaysApi, type EventDay } from '@/lib/api/eventDays';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import type { Person } from '@/lib/api/identity';
import { seasonsApi, type Season } from '@/lib/api/seasons';
import type { EventSession } from '@/lib/api/sessions';
import { teamsApi } from '@/lib/api/teams';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import {
  canBindCertificateTemplates,
  canIssueCertificates,
  canManageCompetitors,
  canReadCertificates,
  canRevokeCertificates,
  canUseCertificateWorkspace,
  canWriteEvent,
  isPrivileged,
  leaderOwnerTeams,
} from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { clearEventDraft, formStateFromEvent, restoreEventEditor } from '@/lib/event-draft';
import { formHandoffFromSearch } from '@/lib/event-forms';
import { openEventMail } from '@/lib/event-mail';
import {
  eventTabFromPath,
  legacyEventAnchorHref,
  showsCompetitionTab,
} from '@/lib/event-workspace';
import { eventFormIssue, eventListSubtitle } from '@/lib/events-view';
import { lookupPeople } from '@/lib/people-lookup';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import {
  canAssignEventTicket,
  canDeskCheckIn,
  canListEventTickets,
  ticketOwnerPeople,
} from '@/lib/tickets-ui';

const eventEditSchema = z
  .object({ event: z.custom<EventFormState>() })
  .superRefine(({ event }, context) => {
    const issue = eventFormIssue(event);
    if (issue) context.addIssue({ code: 'custom', message: issue, path: ['event'] });
  });

/** What the reader may do in this event; each tab shows or hides its parts by these. */
export type EventPermissions = Readonly<{
  canMutate: boolean;
  canDelete: boolean;
  canCompetitors: boolean;
  canTickets: boolean;
  canAssign: boolean;
  canDesk: boolean;
  canCertificates: boolean;
  canReadIssuedCertificates: boolean;
  canIssueCertificate: boolean;
  canBindCertificate: boolean;
  canRevokeCertificate: boolean;
}>;

export function eventPermissions(
  groups: string[],
  roles: string[],
  event: CoreEvent,
  doorAccess: boolean,
): EventPermissions {
  const team = event.ownerTeam;
  return {
    canMutate: canWriteEvent(groups, team, 'update'),
    canDelete: canWriteEvent(groups, team, 'delete'),
    canCompetitors: canManageCompetitors(groups, team),
    canTickets: canListEventTickets(groups, team, roles),
    canAssign: canAssignEventTicket(groups, team),
    canDesk: canDeskCheckIn(groups, team) || doorAccess,
    canCertificates: canUseCertificateWorkspace(groups, roles, team),
    canReadIssuedCertificates: canReadCertificates(groups, roles, team),
    canIssueCertificate: canIssueCertificates(groups, roles, team),
    canBindCertificate: canBindCertificateTemplates(groups, roles, team),
    canRevokeCertificate: canRevokeCertificates(groups, roles, team),
  };
}

export type EventWorkspaceValue = EventPermissions & {
  event: CoreEvent;
  setEvent: (event: CoreEvent) => void;
  days: EventDay[];
  sessions: EventSession[];
  competitors: Competitor[];
  tickets: Ticket[];
  setTickets: (tickets: Ticket[]) => void;
  personById: Map<string, Person>;
  /** A failed action, shown under the tabs. */
  error: string | null;
  setError: (error: string | null) => void;
  /** The last check-in, shown under the tabs. */
  deskNote: string | null;
  setDeskNote: (note: string | null) => void;
  /** Reads the event and everything its tabs show again. */
  reload: () => Promise<void>;
  /** Fills the event's Skymail list (all tickets, or only these) and opens the composer. */
  mailApplicants: (ticketIds?: string[]) => Promise<void>;
};

const EventWorkspaceContext = createContext<EventWorkspaceValue | null>(null);

/** The open event and what its tabs share; only inside the /events/[id] layout. */
export function useEventWorkspace(): EventWorkspaceValue {
  const value = useContext(EventWorkspaceContext);
  if (!value) throw new Error('useEventWorkspace is used outside the event workspace');
  return value;
}

/**
 * The /events/[id] layout: loads the event once, keeps its header, tabs and edit
 * drawer, and gives each tab the data it shows.
 */
export function EventWorkspace({
  eventId: id,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const roles = user?.roles ?? [];
  const privileged = isPrivileged(groups);
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [days, setDays] = useState<EventDay[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // A save the edit drawer refused, shown in the drawer where the organizer is.
  const [editError, setEditError] = useState<string | null>(null);
  const [mailing, setMailing] = useState(false);
  const [deskNote, setDeskNote] = useState<string | null>(null);
  const [doorAccess, setDoorAccess] = useState(false);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const eventEditForm = useForm<z.infer<typeof eventEditSchema>>({
    resolver: zodResolver(eventEditSchema),
    defaultValues: { event: emptyEventForm() },
  });
  const form = eventEditForm.watch('event');

  async function load() {
    try {
      const ev = await eventsApi.get(id);
      const loaded = formStateFromEvent(ev);
      const handoff =
        typeof window === 'undefined'
          ? null
          : formHandoffFromSearch(new URLSearchParams(window.location.search));
      const nextForm = restoreEventEditor(
        typeof window === 'undefined' ? null : sessionStorage,
        typeof window === 'undefined' ? `/events/${id}` : window.location.href,
        loaded,
        handoff,
      );
      setEvent(ev);
      const doorEvents = await ticketsApi.listDoorEvents().catch(() => []);
      setDoorAccess(doorEvents.some((doorEvent) => doorEvent.id === ev.id));
      eventEditForm.reset({ event: nextForm });
      setError(null);
      if (handoff && canWriteEvent(groups, ev.ownerTeam, 'update')) {
        setEditing(true);
        try {
          await saveEventWithSeason(nextForm, ev.id);
          window.history.replaceState(null, '', `/events/${ev.id}`);
          const saved = await eventsApi.get(id);
          setEvent(saved);
          eventEditForm.reset({
            event: {
              ...formStateFromEvent(saved),
              formUrl: saved.formUrl ?? nextForm.formUrl,
              formAlias: saved.formAlias ?? nextForm.formAlias,
              extraFormUrls: saved.extraFormUrls ?? nextForm.extraFormUrls,
              coverImageId: saved.coverImageId ?? nextForm.coverImageId,
            },
          });
          clearEventDraft(sessionStorage, window.location.href);
          setHandoffNote('Skyforms adresi bağlandı. Kısa link kayıtta skyl.app’den basılır.');
        } catch (err) {
          setEditError(coreProblemMessage(err, 'Form adresi kaydedilemedi'));
        }
      }
      const dayRows = await eventDaysApi.listByEvent(id);
      const sessionRows = (
        await Promise.all(dayRows.map((day) => eventDaysApi.listSessions(day.id)))
      ).flat();
      setDays(dayRows);
      setSessions(sessionRows);
      const competitorRows = await competitorsApi.listByEvent(id).catch(() => []);
      setCompetitors(competitorRows);
      const ticketRows = canListEventTickets(groups, ev.ownerTeam, roles)
        ? await ticketsApi.listByEvent(id).catch(() => [] as Ticket[])
        : [];
      setTickets(ticketRows);
      // Tickets carry their owner; only competitors without a ticket are looked up by id.
      const ticketPeople = ticketOwnerPeople(ticketRows);
      const knownPeople = privileged
        ? await lookupPeople(
            competitorRows.map((row) => row.userId),
            ticketPeople,
          )
        : ticketPeople;
      setPeople([...knownPeople.values()]);
      const teams = await teamsApi.list().catch(() => []);
      const leaderTeams = leaderOwnerTeams(groups);
      setOwnerOptions(
        privileged
          ? [...new Set([...teams.map((t) => t.team), ...leaderTeams, ev.ownerTeam])]
          : leaderTeams.length
            ? leaderTeams
            : [ev.ownerTeam],
      );
      if (privileged) setSeasons(await seasonsApi.list().catch(() => []));
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Etkinlik yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  // Links from before the tabs pointed at sections of one page (/events/[id]#program)
  useEffect(() => {
    if (eventTabFromPath(pathname ?? '') !== 'overview') return;
    const target = legacyEventAnchorHref(id, window.location.hash);
    if (target) router.replace(target);
  }, [id, pathname]);

  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  if (error && !event) {
    return <StateCard title={error} description="Etkinlik kartına dönemiyor." tone="danger" />;
  }
  if (!event) return <StateCard title="Yükleniyor…" isLoading />;

  const current = event;
  const can = eventPermissions(groups, roles, event, doorAccess);
  async function mailApplicants(ticketIds?: string[]) {
    setMailing(true);
    try {
      await openEventMail(
        current.id,
        (eventId) => eventsApi.syncMailList(eventId, ticketIds),
        (href) => {
          window.open(href, '_blank', 'noopener,noreferrer');
        },
      );
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Skymail listesi yenilenemedi');
    } finally {
      setMailing(false);
    }
  }

  const workspace: EventWorkspaceValue = {
    ...can,
    event,
    setEvent,
    days,
    sessions,
    competitors,
    tickets,
    setTickets,
    personById,
    error,
    setError,
    deskNote,
    setDeskNote,
    reload: load,
    mailApplicants,
  };

  return (
    <EventWorkspaceContext.Provider value={workspace}>
      <div className="space-y-6">
        <PageHeader
          title={event.name}
          description={eventListSubtitle(event)}
          meta={
            <>
              <StatusChip kind={event.active ? 'active' : 'passive'} />
              {can.canTickets ? (
                <StatusChip kind="neutral" label={`${tickets.length} başvuru`} />
              ) : null}
            </>
          }
          actions={
            <>
              {can.canMutate ? (
                <ActionButton icon={Pencil} label="Düzenle" onClick={() => setEditing(true)} />
              ) : null}
              {can.canTickets ? (
                <ActionButton
                  icon={Mail}
                  label="Etkinlik katılımcılarına mail"
                  disabled={mailing}
                  onClick={() => void mailApplicants()}
                />
              ) : null}
              {can.canDelete ? (
                <ActionButton
                  icon={Trash2}
                  label="Sil"
                  onClick={() =>
                    confirm({
                      title: `"${event.name}" silinsin mi?`,
                      description: `Etkinlik listeden kalkar. ${UNDO_HINT}`,
                      actionLabel: 'Etkinliği sil',
                      onConfirm: async () => {
                        try {
                          await eventsApi.delete(event.id);
                          notify.undoable(
                            'Etkinlik silindi',
                            async () => {
                              await eventsApi.restore(event.id);
                              router.push(`/events/${encodeURIComponent(event.id)}`);
                            },
                            'Etkinlik geri alındı',
                          );
                          router.push('/events');
                        } catch (err) {
                          setError(err instanceof ProblemError ? err.title : 'Silinemedi');
                        }
                      },
                    })
                  }
                />
              ) : null}
            </>
          }
        />
        <EventWorkspaceNav
          eventId={event.id}
          active={eventTabFromPath(pathname ?? '') ?? 'overview'}
          canSeeParticipants={can.canTickets}
          canSeeCompetitors={showsCompetitionTab(can.canCompetitors, competitors.length)}
          canUseDoor={can.canDesk}
          canSeeCertificates={can.canCertificates}
          canSeeFiles={can.canMutate || Boolean(event.videos?.length || event.files?.length)}
        />
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {handoffNote ? <p className="text-skylab-300 text-sm">{handoffNote}</p> : null}
        {deskNote ? (
          <p role="status" aria-label="Check-in sonucu" className="text-skylab-300 text-sm">
            {deskNote}
          </p>
        ) : null}
        {children}
        {confirmDialog}
        <Drawer
          open={editing}
          onClose={() => {
            setEditing(false);
            setEditError(null);
          }}
          title="Etkinliği düzenle"
        >
          <form
            className="space-y-3"
            noValidate
            onSubmit={eventEditForm.handleSubmit(async ({ event: eventForm }) => {
              setEditError(null);
              try {
                await saveEventWithSeason(eventForm, event.id);
                if (typeof window !== 'undefined') {
                  clearEventDraft(sessionStorage, window.location.href);
                }
                setEditing(false);
                notify.success('Etkinlik kaydedildi');
                await load();
              } catch (err) {
                setEditError(coreProblemMessage(err, 'Kaydedilemedi'));
              }
            })}
          >
            <EventEditor
              value={form}
              onChange={(value) =>
                eventEditForm.setValue('event', value, {
                  shouldDirty: true,
                  shouldValidate: eventEditForm.formState.isSubmitted,
                })
              }
              ownerOptions={ownerOptions}
              lockOwner={!privileged}
              seasons={seasons}
              showSeason={privileged}
              ownerOptional={privileged}
              assignDoorStaff={privileged}
              knownMedia={[
                ...(event.coverImageId
                  ? [{ id: event.coverImageId, name: 'Kapak', url: event.coverImageUrl }]
                  : []),
                ...(event.images ?? []).map((image) => ({ id: image.id, url: image.url })),
              ]}
              returnTo={typeof window !== 'undefined' ? window.location.href : ''}
            />
            {eventEditForm.formState.errors.event ? (
              <p className="text-2xs text-destructive">
                {eventEditForm.formState.errors.event.message}
              </p>
            ) : null}
            {editError ? (
              <p role="alert" className="text-destructive text-sm">
                {editError}
              </p>
            ) : null}
            <SaveButton disabled={eventEditForm.formState.isSubmitting}>
              {eventEditForm.formState.isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
            </SaveButton>
          </form>
        </Drawer>
      </div>
    </EventWorkspaceContext.Provider>
  );
}
