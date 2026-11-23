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
  Copy,
  DoorClosed,
  DoorOpen,
  FileEdit,
  Mail,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { ActionButton } from '@/components/chrome/ActionButton';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { PageHeader } from '@/components/layout/PageHeader';
import { emptyEventForm, type EventFormState } from '@/components/scheduling/EventEditor';
import { useEventCopy } from '@/components/scheduling/EventCopyDialog';
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
import { sessionsApi, type EventSession } from '@/lib/api/sessions';
import { teamsApi } from '@/lib/api/teams';
import { ticketsApi, type Ticket } from '@/lib/api/tickets';
import { urlsApi } from '@/lib/api/urls';
import {
  canBindCertificateTemplates,
  canIssueCertificates,
  canManageCompetitors,
  canReadCertificates,
  canRevokeCertificates,
  canUseCertificateWorkspace,
  canWriteEvent,
  isPrivileged,
} from '@/lib/auth/groups';
import { coreProblemMessage, formInUseOf, type FormInUse } from '@/lib/core-problems';
import { copySkippedLines, takeCopySkipped } from '@/lib/event-copy';
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
  eventEditHref,
  eventTabFromPath,
  isEventEditPath,
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
import { linkSessionFeedbackForm, sessionIdOfFeedbackSlot } from '@/lib/session-feedback';
import { useNotify } from '@/lib/ui/use-notify';
import {
  canAssignEventTicket,
  canDeskCheckIn,
  canListEventTickets,
  ticketOwnerPeople,
} from '@/lib/tickets-ui';
import { useCapabilities } from '@/lib/capabilities-context';
import { leaderTeamsOf, teamDecision, type TeamDecide } from '@/lib/use-app-can';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

export const eventEditSchema = z
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
 * core's decisions for the event's Owner team (`decide`, see teamDecision),
 * the group rule's permissions standing in only when core's capabilities cannot
 * be read: a DK member reads the event and its tabs but gets no write, and a
 * Leader of a Team above leads a Sub-team's event (core ticket 12), which the
 * group rule cannot see. Door check-in stays open to the event's door staff.
 */
export function withTeamCapabilities(
  can: EventPermissions,
  ownerTeam: string,
  decide: TeamDecide,
  doorAccess: boolean,
): EventPermissions {
  const team = (key: string, groupRule: boolean) => decide(ownerTeam, key, groupRule);
  return {
    canMutate: team('event.update', can.canMutate),
    canDelete: team('event.delete', can.canDelete),
    canCompetitors: team('competitor.update', can.canCompetitors),
    canTickets: team('ticket.read', can.canTickets),
    canAssign: team('ticket.assign', can.canAssign),
    canDesk: doorAccess || team('door.checkIn', can.canDesk),
    // The tab: any certificate decision of the team
    canCertificates:
      team('certificate.read', can.canCertificates) ||
      ['certificate.issue', 'certificate.revoke', 'certificateTemplate.assign'].some((key) =>
        team(key, false),
      ),
    canReadIssuedCertificates: team('certificate.read', can.canReadIssuedCertificates),
    canIssueCertificate: team('certificate.issue', can.canIssueCertificate),
    canBindCertificate: team('certificateTemplate.assign', can.canBindCertificate),
    canRevokeCertificate: team('certificate.revoke', can.canRevokeCertificate),
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

export type EventEditFormValues = z.infer<typeof eventEditSchema>;

/** The event's edit form, kept by the workspace so a return from Skyforms lands in it. */
export type EventEditorState = {
  form: UseFormReturn<EventEditFormValues>;
  /** False until the event's fields are in the form. */
  ready: boolean;
  ownerOptions: string[];
  seasons: Season[];
  privileged: boolean;
  /** The last save core refused, said in the save bar. */
  error: string | null;
  inUse: FormInUse | null;
  /** Owner teams or seasons that could not be read; `reloadOptions` reads them again. */
  optionsFailed: { teams: boolean; seasons: boolean };
  reloadOptions: () => Promise<void>;
  /** Saves the changed fields; true once core took them (the event is then read again). */
  save: (values: EventFormState) => Promise<boolean>;
};

export type EventWorkspaceValue = EventPermissions & {
  event: CoreEvent;
  setEvent: (event: CoreEvent) => void;
  days: EventDay[];
  sessions: EventSession[];
  competitors: Competitor[];
  tickets: Ticket[];
  setTickets: (tickets: Ticket[]) => void;
  personById: Map<string, Person>;
  /** A failed action of the header (publish, mail, …), shown under it. */
  error: string | null;
  /** The tickets could not be read: the Katılımcılar tab says so with a retry. */
  ticketsFailed: boolean;
  /** The competitors could not be read. */
  competitorsFailed: boolean;
  setError: (error: string | null) => void;
  /** Reads the event and everything its tabs show again. */
  reload: () => Promise<void>;
  /** Fills the event's Skymail list (all tickets, or only these) and opens the composer. */
  mailApplicants: (ticketIds?: string[]) => Promise<void>;
  editor: EventEditorState;
};

/** A read's rows, and whether it was read (false: it failed and the rows are empty). */
type Settled<T> = { rows: T[]; ok: boolean };

function settled<T>(read: Promise<T[]>): Promise<Settled<T>> {
  return read.then(
    (rows) => ({ rows, ok: true }),
    () => ({ rows: [] as T[], ok: false }),
  );
}

/** The owner-team and season reads `load()` starts with the event, for `loadOptions`. */
type OptionReads = {
  teams: Promise<Settled<{ team: string }>>;
  seasons: Promise<Settled<Season>> | null;
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
  // load() runs once per event, before core's capabilities may have arrived: it
  // reads the latest answer through this ref and waits for it to settle
  const capabilities = useCapabilities();
  const decide: TeamDecide = (ownerTeam, key, groupRule) =>
    teamDecision(capabilities, ownerTeam, key, groupRule);
  const capabilitiesRef = useRef({
    settled: false,
    state: capabilities,
    waiters: [] as Array<() => void>,
  });
  capabilitiesRef.current.settled = capabilities.status !== 'loading';
  capabilitiesRef.current.state = capabilities;
  useEffect(() => {
    if (capabilities.status === 'loading') return;
    for (const wake of capabilitiesRef.current.waiters.splice(0)) wake();
  }, [capabilities.status]);
  /** Resolves once the capabilities are in (or unreadable). */
  function capabilitiesSettled(): Promise<void> {
    if (capabilitiesRef.current.settled) return Promise.resolve();
    return new Promise((resolve) => {
      capabilitiesRef.current.waiters.push(resolve);
    });
  }
  /** core's decision for the event once the capabilities are in; `groupRule` if unreadable. */
  async function teamAllows(ownerTeam: string, key: string, groupRule: boolean): Promise<boolean> {
    await capabilitiesSettled();
    return teamDecision(capabilitiesRef.current.state, ownerTeam, key, groupRule);
  }
  const [event, setEvent] = useState<CoreEvent | null>(null);
  const [days, setDays] = useState<EventDay[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  // Until the tickets are read (or when the read failed) the page has no count to give
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  // Lists core did not answer: their tabs say so with a retry, not an empty list
  const [ticketsFailed, setTicketsFailed] = useState(false);
  const [competitorsFailed, setCompetitorsFailed] = useState(false);
  const [optionsFailed, setOptionsFailed] = useState({ teams: false, seasons: false });
  const [people, setPeople] = useState<Person[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  // A save the edit page refused, shown in its save bar where the organizer is.
  const [editError, setEditError] = useState<string | null>(null);
  const [editInUse, setEditInUse] = useState<FormInUse | null>(null);
  const [mailing, setMailing] = useState(false);
  const [doorAccess, setDoorAccess] = useState(false);
  const notify = useNotify();
  const rightsFor = useEventStatusRights();
  const statusActions = useEventStatusActions({
    onChanged: (next) => {
      setError(null);
      // core answers the whole Event and leaves a cleared field out (an undone cancellation's
      // reason and mail): take its answer, keeping only a media list an answer comes without
      setEvent((current) =>
        current
          ? {
              ...next,
              images: next.images ?? current.images,
              imageUrls: next.imageUrls ?? current.imageUrls,
              files: next.files ?? current.files,
              videos: next.videos ?? current.videos,
            }
          : next,
      );
    },
    onError: setError,
  });
  const copy = useEventCopy();
  // What core left out of the copy this page opened as, said once (the copy dialog keeps it)
  const [copySkipped, setCopySkipped] = useState<string[]>([]);
  useEffect(() => {
    setCopySkipped(typeof window === 'undefined' ? [] : takeCopySkipped(sessionStorage, id));
  }, [id]);
  const eventEditForm = useForm<EventEditFormValues>({
    resolver: zodResolver(eventEditSchema),
    defaultValues: { event: emptyEventForm() },
  });
  // What the edit page opened with: a save sends only the fields changed since
  const editBase = useRef<EventFormState | null>(null);
  function resetEditor(next: EventFormState) {
    editBase.current = next;
    eventEditForm.reset({ event: next });
  }

  async function load() {
    // Reads that need nothing from the event start with it: one round instead of one each
    const doorRead = ticketsApi.listDoorEvents().catch(() => []);
    const programRead = eventDaysApi.listByEvent(id).then(async (dayRows) => ({
      dayRows,
      sessionRows: (
        await Promise.all(dayRows.map((day) => eventDaysApi.listSessions(day.id)))
      ).flat(),
    }));
    // Awaited once the event is read: its failure then fails the load, as before
    programRead.catch(() => undefined);
    const competitorsRead = settled(competitorsApi.listByEvent(id));
    const optionsRead: OptionReads = {
      teams: settled(teamsApi.list()),
      seasons: privileged ? settled(seasonsApi.list()) : null,
    };
    try {
      const ev = await eventsApi.get(id);
      const loaded = formStateFromEvent(ev);
      const returned =
        typeof window === 'undefined'
          ? null
          : formHandoffFromSearch(new URLSearchParams(window.location.search));
      // A Session's feedback form comes back to its Session, not to the Event's editor
      const sessionReturn =
        returned && sessionIdOfFeedbackSlot(returned.formSlot) ? returned : null;
      const handoff = sessionReturn ? null : returned;
      const nextForm = restoreEventEditor(
        typeof window === 'undefined' ? null : sessionStorage,
        typeof window === 'undefined' ? `/events/${id}` : window.location.href,
        loaded,
        handoff,
      );
      setEvent(ev);
      // Started now, read below: a reader who may not list them gets none, a refused read says so
      let ticketsRead = false;
      let ticketsRefused = false;
      const ticketsReadAll = teamAllows(
        ev.ownerTeam,
        'ticket.read',
        canListEventTickets(groups, ev.ownerTeam, roles),
      ).then((allowed) =>
        allowed
          ? ticketsApi
              .listByEvent(id)
              .then((rows) => {
                ticketsRead = true;
                return rows;
              })
              .catch(() => {
                ticketsRefused = true;
                return [] as Ticket[];
              })
          : [],
      );
      const doorEvents = await doorRead;
      setDoorAccess(doorEvents.some((doorEvent) => doorEvent.id === ev.id));
      resetEditor(nextForm);
      setError(null);
      // A DK member who comes back from Skyforms gets no editor: the save would be refused
      if (
        handoff &&
        (await teamAllows(
          ev.ownerTeam,
          'event.update',
          canWriteEvent(groups, ev.ownerTeam, 'update'),
        ))
      ) {
        // Skyforms comes back to the event; the edit page shows what was linked
        const editPage = eventEditHref(ev.id);
        try {
          // The return from Skyforms changed the form fields alone
          await saveEventWithSeason(nextForm, ev.id, loaded);
          router.replace(editPage);
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
          setHandoffNote('Form bağlandı.');
        } catch (err) {
          setEditError(coreProblemMessage(err, 'Form adresi kaydedilemedi'));
          setEditInUse(formInUseOf(err));
          router.replace(`${editPage}${window.location.search}`);
        }
      }
      const { dayRows, sessionRows } = await programRead;
      setDays(dayRows);
      setSessions(sessionRows);
      if (sessionReturn) await linkReturnedSessionForm(ev, sessionRows, sessionReturn);
      const competitors = await competitorsRead;
      const competitorRows = competitors.rows;
      setCompetitors(competitorRows);
      setCompetitorsFailed(!competitors.ok);
      const ticketRows = await ticketsReadAll;
      setTickets(ticketRows);
      setTicketsLoaded(ticketsRead);
      setTicketsFailed(ticketsRefused);
      // Tickets carry their owner; only competitors without a ticket are looked up by id.
      const ticketPeople = ticketOwnerPeople(ticketRows);
      const knownPeople = privileged
        ? await lookupPeople(
            competitorRows.map((row) => row.userId),
            ticketPeople,
          )
        : ticketPeople;
      setPeople([...knownPeople.values()]);
      await loadOptions(ev, optionsRead);
    } catch (err) {
      setError(
        coreProblemMessage(err, 'Etkinlik yüklenemedi', {
          404: 'Etkinlik bulunamadı; silinmiş olabilir.',
        }),
      );
    }
  }

  /**
   * The edit page's choices: owner teams and seasons; a failed read is said at its field. `load()`
   * passes the reads it started with the event; "Yeniden dene" reads them again.
   */
  async function loadOptions(ev: CoreEvent, started?: OptionReads) {
    const reads: OptionReads = started ?? {
      teams: settled(teamsApi.list()),
      seasons: privileged ? settled(seasonsApi.list()) : null,
    };
    const { rows: teams, ok: teamsRead } = await reads.teams;
    // core's LEADER teams (a Sub-team led from above included), always with the event's own
    await capabilitiesSettled();
    const leaderTeams = leaderTeamsOf(capabilitiesRef.current.state, groups);
    setOwnerOptions(
      privileged
        ? [...new Set([...teams.map((t) => t.team), ...leaderTeams, ev.ownerTeam])]
        : leaderTeams.length
          ? [...new Set([...leaderTeams, ev.ownerTeam])]
          : [ev.ownerTeam],
    );
    let seasonsRead = true;
    if (reads.seasons) {
      const seasons = await reads.seasons;
      seasonsRead = seasons.ok;
      setSeasons(seasons.rows);
    }
    setOptionsFailed({ teams: privileged && !teamsRead, seasons: !seasonsRead });
  }

  /**
   * Back from Skyforms with a Session's feedback form: it is saved on the
   * Session with its short link, and the Program tab opens.
   */
  async function linkReturnedSessionForm(
    ev: CoreEvent,
    rows: EventSession[],
    back: { formUrl: string; formSlot: string },
  ) {
    const sessionId = sessionIdOfFeedbackSlot(back.formSlot);
    const session = rows.find((row) => row.id === sessionId);
    const refused = !session
      ? 'Oturum bulunamadı; form bağlanmadı.'
      : !(await teamAllows(
            ev.ownerTeam,
            'event.update',
            canWriteEvent(groups, ev.ownerTeam, 'update'),
          ))
        ? 'Bu oturumu düzenleme yetkin yok; form bağlanmadı.'
        : null;
    if (!session || refused) {
      // The return is dropped from the address: a reload would not try it again
      const url = new URL(window.location.href);
      url.searchParams.delete('formUrl');
      url.searchParams.delete('formSlot');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      setError(refused);
      return;
    }
    try {
      await linkSessionFeedbackForm(ev, session, back.formUrl, {
        create: (body) => urlsApi.create(body),
        update: (sessionId, body) => sessionsApi.update(sessionId, body),
      });
      const fresh = await eventDaysApi.listSessions(session.eventDayId);
      setSessions(rows.map((row) => fresh.find((next) => next.id === row.id) ?? row));
      notify.success('Geri bildirim formu oturuma bağlandı');
      router.replace(`/events/${encodeURIComponent(ev.id)}/program`);
    } catch (err) {
      setError(coreProblemMessage(err, 'Oturumun geri bildirim formu kaydedilemedi'));
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
    return <StateCard title={error} tone="danger" />;
  }
  if (!event) return <PageSkeleton variant="workspace" />;

  const current = event;
  // core's capabilities decide; the group rule stands in only when they cannot be read
  const readable = eventPermissions(groups, roles, event, doorAccess);
  const can = withEventStatus(
    withTeamCapabilities(readable, event.ownerTeam, decide, doorAccess),
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
  // None while the tickets are not read: the cancel dialog then reads the count itself
  const ticketCount = can.canTickets && ticketsLoaded ? tickets.length : undefined;
  const menuItems = [
    copy.canCopy(event) ? (
      <MenuItem key="copy" icon={Copy} onClick={() => copy.askCopy(event)}>
        Kopyala…
      </MenuItem>
    ) : null,
    rights.canUpdate && offers.unpublish ? (
      <MenuItem
        key="unpublish"
        icon={FileEdit}
        disabled={Boolean(ticketCount)}
        onClick={() => void statusActions.unpublish(event)}
      >
        Taslağa al
        {ticketCount ? (
          <span className="text-subtle-foreground ml-auto pl-3 text-[13px]/5">
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
      setError(coreProblemMessage(err, 'E-posta listesi hazırlanamadı'));
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
    ticketsFailed,
    competitorsFailed,
    reload: load,
    mailApplicants,
    editor: {
      form: eventEditForm,
      ready: editBase.current !== null,
      ownerOptions,
      seasons,
      privileged,
      error: editError,
      inUse: editInUse,
      optionsFailed,
      reloadOptions: () => loadOptions(current),
      save: async (values) => {
        setEditError(null);
        setEditInUse(null);
        try {
          await saveEventWithSeason(values, current.id, editBase.current ?? undefined);
        } catch (err) {
          setEditError(coreProblemMessage(err, 'Kaydedilemedi'));
          setEditInUse(formInUseOf(err));
          return false;
        }
        if (typeof window !== 'undefined') clearEventDraft(sessionStorage, window.location.href);
        notify.success('Etkinlik kaydedildi');
        void load();
        return true;
      },
    },
  };
  const onEditPage = isEventEditPath(pathname ?? '');
  // Publishing from the edit page would publish the saved event, not what is typed
  const unsavedEdit = onEditPage && eventEditForm.formState.isDirty;

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
                <SaveButton
                  type="button"
                  disabled={unsavedEdit}
                  title={unsavedEdit ? 'Önce kaydet' : undefined}
                  onClick={() =>
                    void statusActions.publish(
                      event,
                      can.canTickets && ticketsLoaded ? tickets : undefined,
                      personById,
                    )
                  }
                >
                  Yayınla
                </SaveButton>
              ) : null}
              {can.canMutate && !onEditPage ? (
                <ActionButton
                  icon={Pencil}
                  label="Düzenle"
                  showLabel
                  iconOnlyOnPhone
                  href={eventEditHref(event.id)}
                />
              ) : null}
              {can.canTickets ? (
                <ActionButton
                  icon={Mail}
                  label="Katılımcılara e-posta"
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
                    <Button
                      className={BUTTON_TEXT}
                      size="sm"
                      onClick={() => statusActions.askUncancel(event)}
                    >
                      İptali geri al
                    </Button>
                  ) : null}
                  {closeFormHref ? (
                    <a
                      href={closeFormHref}
                      className="text-skylab-300 text-[13px]/5 hover:underline"
                    >
                      Formu kapat
                    </a>
                  ) : null}
                </div>
              ) : undefined
            }
          >
            {event.cancelReason || undefined}
          </Notice>
        ) : null}
        {copySkipped.length ? (
          <Notice tone="warning" onDismiss={() => setCopySkipped([])}>
            {copySkippedLines(copySkipped).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Notice>
        ) : null}
        {onEditPage ? null : (
          <EventWorkspaceNav
            eventId={event.id}
            active={eventTabFromPath(pathname ?? '') ?? 'overview'}
            canSeeParticipants={can.canTickets}
            canSeeCompetitors={showsCompetitionTab(can.canCompetitors, competitors.length)}
            canUseDoor={can.canDesk}
            canSeeCertificates={can.canCertificates}
            canSeeFiles={can.canMutate || Boolean(event.videos?.length || event.files?.length)}
          />
        )}
        {error ? (
          <Notice tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        {handoffNote ? <p className="text-skylab-300 text-sm">{handoffNote}</p> : null}
        {children}
        {statusActions.dialog}
        {copy.dialog}
      </div>
    </EventWorkspaceContext.Provider>
  );
}
