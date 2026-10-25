'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useRouter } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
  MenuItem,
  Notice,
} from '@skylab-kulubu/skylcn-ui';
import {
  Ban,
  DoorClosed,
  DoorOpen,
  FileEdit,
  Mail,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  emptyEventForm,
  EventEditor,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { EventWorkspaceNav } from '@/components/scheduling/EventWorkspaceNav';
import {
  eventStatusActions,
  useEventStatusActions,
  useEventStatusRights,
} from '@/components/scheduling/use-event-status-actions';
import { useAuth } from '@/context/AuthContext';
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
import {
  formHandoffFromSearch,
  formsAdminOrigin,
  skyformsEditHref,
  skyformsFormId,
} from '@/lib/event-forms';
import { openEventMail } from '@/lib/event-mail';
import { publicMediaUrl } from '@/lib/event-media';
import {
  eventTabFromPath,
  legacyEventAnchorHref,
  showsCompetitionTab,
} from '@/lib/event-workspace';
import {
  eventDisplayStatus,
  eventFormIssue,
  eventListSubtitle,
  eventStatusOf,
} from '@/lib/events-view';
import { lookupPeople } from '@/lib/people-lookup';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import { useNotify } from '@/lib/ui/use-notify';
import {
  canAssignEventTicket,
  canDeskCheckIn,
  canListEventTickets,
  ticketOwnerPeople,
} from '@/lib/tickets-ui';
import { useCapabilities } from '@/lib/capabilities-context';
import { useTeamCan } from '@/lib/use-app-can';

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

/**
 * The group rule's permissions narrowed by core's capabilities for the event's
 * Owner team (`teamCan`, see useTeamCan): a DK member reads the event and its
 * tabs but gets no write. Reading parts (tickets, certificates) stay the group
 * rule's; door check-in stays open to the event's door staff.
 */
export function withTeamCapabilities(
  can: EventPermissions,
  ownerTeam: string,
  teamCan: (ownerTeam: string, key: string) => boolean,
  doorAccess: boolean,
): EventPermissions {
  const team = (key: string) => teamCan(ownerTeam, key);
  return {
    ...can,
    canMutate: can.canMutate && team('event.update'),
    canDelete: can.canDelete && team('event.delete'),
    canCompetitors: can.canCompetitors && team('competitor.update'),
    canAssign: can.canAssign && team('ticket.assign'),
    canDesk: doorAccess || (can.canDesk && team('door.checkIn')),
    canIssueCertificate: can.canIssueCertificate && team('certificate.issue'),
    canBindCertificate: can.canBindCertificate && team('certificateTemplate.assign'),
    canRevokeCertificate: can.canRevokeCertificate && team('certificate.revoke'),
  };
}

/**
 * A cancelled Event takes no new person, check-in or certificate (core
 * refuses them): its add, door and issue buttons go until the cancellation
 * is undone. Reading stays.
 */
export function withEventStatus(can: EventPermissions, event: CoreEvent): EventPermissions {
  if (eventStatusOf(event) !== 'cancelled') return can;
  return { ...can, canAssign: false, canDesk: false, canIssueCertificate: false };
}

/** "12 Ekim 2026" for the cancellation band. */
function cancelledOn(at: string | undefined): string {
  const date = at ? new Date(at) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
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
  const teamCan = useTeamCan();
  // load() runs once per event, before core's capabilities may have arrived: it
  // reads the latest answer through this ref and waits for it to settle
  const capabilities = useCapabilities();
  const capabilitiesRef = useRef({ settled: false, teamCan, waiters: [] as Array<() => void> });
  capabilitiesRef.current.settled = capabilities.status !== 'loading';
  capabilitiesRef.current.teamCan = teamCan;
  useEffect(() => {
    if (capabilities.status === 'loading') return;
    for (const wake of capabilitiesRef.current.waiters.splice(0)) wake();
  }, [capabilities.status]);
  /** Resolves with core's decision for the event once the capabilities are in (or unreadable). */
  function teamAllows(ownerTeam: string, key: string): Promise<boolean> {
    const decide = () => capabilitiesRef.current.teamCan(ownerTeam, key);
    if (capabilitiesRef.current.settled) return Promise.resolve(decide());
    return new Promise((resolve) => {
      capabilitiesRef.current.waiters.push(() => resolve(decide()));
    });
  }
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
  const [doorAccess, setDoorAccess] = useState(false);
  const notify = useNotify();
  const rightsFor = useEventStatusRights();
  const statusActions = useEventStatusActions({
    onChanged: (next) => {
      setError(null);
      // The transitions answer the Event without its media lists; keep what the page read
      setEvent((current) => (current ? { ...current, ...next } : next));
    },
    onError: setError,
  });
  const eventEditForm = useForm<z.infer<typeof eventEditSchema>>({
    resolver: zodResolver(eventEditSchema),
    defaultValues: { event: emptyEventForm() },
  });
  const form = eventEditForm.watch('event');
  // What the edit drawer opened with: a save sends only the fields changed since
  const editBase = useRef<EventFormState | null>(null);
  function resetEditor(next: EventFormState) {
    editBase.current = next;
    eventEditForm.reset({ event: next });
  }

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
      resetEditor(nextForm);
      setError(null);
      // A DK member who comes back from Skyforms gets no editor: the save would be refused
      if (
        handoff &&
        canWriteEvent(groups, ev.ownerTeam, 'update') &&
        (await teamAllows(ev.ownerTeam, 'event.update'))
      ) {
        setEditing(true);
        try {
          // The return from Skyforms changed the form fields alone
          await saveEventWithSeason(nextForm, ev.id, loaded);
          window.history.replaceState(null, '', `/events/${ev.id}`);
          const saved = await eventsApi.get(id);
          setEvent(saved);
          resetEditor({
            ...formStateFromEvent(saved),
            formUrl: saved.formUrl ?? nextForm.formUrl,
            formAlias: saved.formAlias ?? nextForm.formAlias,
            extraFormUrls: saved.extraFormUrls ?? nextForm.extraFormUrls,
            coverImageId: saved.coverImageId ?? nextForm.coverImageId,
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
      setError(
        coreProblemMessage(err, 'Etkinlik yüklenemedi', {
          404: 'Etkinlik bulunamadı; silinmiş olabilir.',
        }),
      );
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
  useChromeCrumbName(`/events/${id}`, event?.name);

  if (error && !event) {
    return <StateCard title={error} description="Etkinlik kartına dönemiyor." tone="danger" />;
  }
  if (!event) return <StateCard title="Yükleniyor…" isLoading />;

  const current = event;
  // The group rule decides what is read (tabs); core's capabilities narrow the writes
  const readable = eventPermissions(groups, roles, event, doorAccess);
  const can = withEventStatus(
    withTeamCapabilities(readable, event.ownerTeam, teamCan, doorAccess),
    event,
  );
  // Status actions follow core's capabilities for the Owner team alone (DK: none)
  const rights = rightsFor(event);
  const offers = eventStatusActions(event);
  const status = eventDisplayStatus(event);
  const formId = event.formUrl ? skyformsFormId(event.formUrl) : null;
  const closeFormHref =
    formId && rights.canUpdate
      ? skyformsEditHref(
          formsAdminOrigin(),
          formId,
          typeof window !== 'undefined' ? window.location.href : '',
        )
      : null;
  const ticketCount = can.canTickets ? tickets.length : undefined;
  const menuItems = [
    rights.canUpdate && offers.unpublish ? (
      <MenuItem
        key="unpublish"
        icon={FileEdit}
        disabled={Boolean(ticketCount)}
        onClick={() => void statusActions.unpublish(event)}
      >
        Taslağa al
        {ticketCount ? (
          <span className="text-subtle-foreground ml-auto pl-3 text-xs">
            {ticketCount} kayıt var
          </span>
        ) : null}
      </MenuItem>
    ) : null,
    rights.canUpdate && offers.registration ? (
      <MenuItem
        key="registration"
        icon={event.registrationClosed ? DoorOpen : DoorClosed}
        onClick={() => void statusActions.setRegistrationClosed(event, !event.registrationClosed)}
      >
        {event.registrationClosed ? 'Başvuruyu aç' : 'Başvuruyu kapat'}
      </MenuItem>
    ) : null,
    rights.canUpdate && offers.cancel ? (
      <MenuItem
        key="cancel"
        icon={Ban}
        destructive
        onClick={() => void statusActions.askCancel(event, ticketCount)}
      >
        İptal et…
      </MenuItem>
    ) : null,
    rights.canUpdate && offers.uncancel ? (
      <MenuItem key="uncancel" icon={RotateCcw} onClick={() => statusActions.askUncancel(event)}>
        İptali geri al…
      </MenuItem>
    ) : null,
    rights.canDelete && offers.delete ? (
      <MenuItem
        key="delete"
        icon={Trash2}
        destructive
        onClick={() =>
          statusActions.askDelete(event, {
            onDeleted: () => router.push('/events'),
            onRestored: (restored) => router.push(`/events/${encodeURIComponent(restored.id)}`),
          })
        }
      >
        Sil…
      </MenuItem>
    ) : null,
  ].filter(Boolean);
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
      setError(coreProblemMessage(err, 'Skymail listesi yenilenemedi'));
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
    reload: load,
    mailApplicants,
  };

  return (
    <EventWorkspaceContext.Provider value={workspace}>
      <div className="space-y-6">
        <PageHeader
          cover={
            event.coverImageUrl ? (
              <img src={publicMediaUrl(event.coverImageUrl)} alt="" />
            ) : undefined
          }
          title={event.name}
          description={eventListSubtitle(event)}
          meta={
            <>
              <StatusChip kind={status} />
              {event.active && event.registrationOpen === false ? (
                <StatusChip kind="neutral" label="Başvuru kapalı" />
              ) : null}
              {can.canTickets ? (
                <StatusChip kind="neutral" label={`${tickets.length} başvuru`} />
              ) : null}
            </>
          }
          actions={
            <>
              {rights.canUpdate && offers.publish ? (
                <SaveButton type="button" onClick={() => void statusActions.publish(event)}>
                  Yayınla
                </SaveButton>
              ) : null}
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
              {menuItems.length ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <IconButton icon={MoreHorizontal} variant="ghost" label="Diğer eylemler" />
                    }
                  />
                  <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          }
        />
        {status === 'cancelled' ? (
          <Notice
            tone="danger"
            title={
              cancelledOn(event.cancelledAt)
                ? `${cancelledOn(event.cancelledAt)} tarihinde iptal edildi.`
                : 'İptal edildi.'
            }
            action={
              rights.canUpdate || closeFormHref ? (
                <div className="flex flex-wrap items-center gap-2">
                  {rights.canUpdate ? (
                    <Button size="sm" onClick={() => statusActions.askUncancel(event)}>
                      İptali geri al
                    </Button>
                  ) : null}
                  {closeFormHref ? (
                    <a href={closeFormHref} className="text-skylab-300 text-xs hover:underline">
                      SkyForms&apos;ta formu kapat
                    </a>
                  ) : null}
                </div>
              ) : undefined
            }
          >
            {event.cancelReason || undefined}
          </Notice>
        ) : null}
        <EventWorkspaceNav
          eventId={event.id}
          active={eventTabFromPath(pathname ?? '') ?? 'overview'}
          canSeeParticipants={can.canTickets}
          canSeeCompetitors={showsCompetitionTab(readable.canCompetitors, competitors.length)}
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
        {children}
        {statusActions.dialog}
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
                await saveEventWithSeason(eventForm, event.id, editBase.current ?? undefined);
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
