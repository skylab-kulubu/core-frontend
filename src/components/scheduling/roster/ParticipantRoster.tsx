'use client';

import {
  BulkBar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  FilterPills,
  IconButton,
  MenuItem,
  SearchInput,
} from '@skylab-kulubu/skylcn-ui';
import {
  CheckCircle2,
  ChevronRight,
  Mail,
  Ban,
  ChevronsUp,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Avatar } from '@/components/chrome/Avatar';
import { Drawer } from '@/components/chrome/Drawer';
import { ListPanel } from '@/components/chrome/ListPanel';
import { LoadError } from '@/components/chrome/LoadError';
import { Pagination } from '@/components/chrome/Pagination';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { waitedFor, waitlistOrder, waitlistPlaces } from '@/lib/capacity';
import { defaultDoorSessionId, doorSessionLabel, type DoorSession } from '@/lib/door-check-in';
import { emptyListCopy } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import {
  formatEntry,
  inRosterView,
  lastCheckInAt,
  ROSTER_VIEWS,
  rosterViewCounts,
  type RosterView,
} from '@/lib/roster-insights';
import { ticketTypeStatus } from '@/lib/status-chip';
import {
  filterApplicantRoster,
  isTicketCancelled,
  ticketMailRecipients,
  ticketRosterRow,
  type TicketMailRecipient,
  type TicketSourceEvent,
} from '@/lib/tickets-ui';
import type { RespondentView } from './RespondentList';
import { CapacityStrip, RosterChartsSection, RosterTiles } from './RosterOverview';
import { cancelShut, EVENT_OVER } from './ticket-cancel';
import { TicketPanel } from './TicketPanel';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

const PAGE_SIZE = 20;
const SORTS = {
  newest: 'Yeni kayıt önce',
  oldest: 'Eski kayıt önce',
  name: 'Ada göre',
  checkIn: 'Son giriş önce',
} as const;
type Sort = keyof typeof SORTS;
/**
 * The views of the active tickets, and the waiting list and the cancelled ones core lists
 * apart (`?status=waitlisted`, `?status=cancelled`).
 */
type ListView = RosterView | 'waitlisted' | 'cancelled' | RespondentView;
const WAITLIST_VIEW = { value: 'waitlisted', label: 'Bekleme listesi' } as const;
const CANCELLED_VIEW = { value: 'cancelled', label: 'İptal edilenler' } as const;
/** Form answers with no Ticket yet (core docs/form-respondents.md): not Tickets, listed apart. */
const UNTICKETED_VIEW = { value: 'unticketed', label: 'Bileti yok' } as const;
const FORMS_PENDING_VIEW = { value: 'formsPending', label: 'Forms’ta onay bekliyor' } as const;
type Saved = { query?: string; view?: RosterView; sort?: Sort; page?: number };

export type ParticipantRosterProps = {
  eventId: string;
  /** The active tickets. */
  tickets: Ticket[];
  /** The cancelled tickets; absent while unread or when they cannot be read. */
  cancelledTickets?: Ticket[];
  /** The waiting list; absent while unread or when it cannot be read. */
  waitlistedTickets?: Ticket[];
  /** The Event's capacity, 0 for none. */
  capacity?: number;
  people: Map<string, Person>;
  event?: TicketSourceEvent | null;
  sessions: readonly DoorSession[];
  failed?: boolean;
  onRetry?: () => void | Promise<unknown>;
  openTicket: Ticket | null;
  onOpenTicket: (ticket: Ticket | null) => void;
  onAddParticipant?: () => void;
  /** "İçe aktar": a list from another form turned into tickets (core docs/attendee-import.md). */
  onImport?: () => void;
  onMail: (recipients: TicketMailRecipient[]) => void;
  /** Writes the entry; a refusal comes back as its text and shows in the row. */
  onMarkAttended?: (ticket: Ticket, sessionId: string) => Promise<string | null>;
  onResend?: (ticket: Ticket) => void;
  onRenew?: (ticket: Ticket) => void;
  /** "Bileti iptal et": only for who may edit the event. */
  onCancel?: (ticket: Ticket) => void;
  /** "Geri al" on a cancelled ticket. */
  onRestore?: (ticket: Ticket) => void;
  /** "Öne al" on a waitlisted ticket; who may cancel may promote. */
  onPromote?: (ticket: Ticket) => void;
  /** The event is over: cancel and Geri al are shown but shut (core `event_ended`). */
  eventEnded?: boolean;
  /** The page's confirm dialog: inside the drawer while one is open, so it sits above it. */
  dialogs: ReactNode;
  /**
   * The Unticketed respondents' counts; absent for a core without them. `failed`: unread now,
   * the views stay so their list can say so and read again.
   */
  respondentCounts?: { unticketed: number; formsPending: number; failed?: boolean };
  /** Their list, in place of the Tickets', for the two respondent views. */
  renderRespondents?: (view: RespondentView, query: string) => ReactNode;
  /** "İndir" in the toolbar (ExportMenu): the rows the list shows, in its order, and whether narrowed. */
  renderExport?: (shown: { ticketIds: string[]; filtered: boolean }) => ReactNode;
};

/**
 * The Katılımcılar tab: figures that open their view, the list with views and its search, the
 * charts under it (they fold away), and the registration beside the list.
 */
export function ParticipantRoster({
  eventId,
  tickets,
  cancelledTickets,
  waitlistedTickets,
  capacity = 0,
  people,
  event,
  sessions,
  failed,
  onRetry,
  openTicket,
  onOpenTicket,
  onAddParticipant,
  onImport,
  onMail,
  onMarkAttended,
  onResend,
  onRenew,
  onCancel,
  onRestore,
  onPromote,
  eventEnded = false,
  dialogs,
  respondentCounts,
  renderRespondents,
  renderExport,
}: ParticipantRosterProps) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ListView>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [page, setPage] = useState(1);
  const [restored, setRestored] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState(() => defaultDoorSessionId(sessions));
  const attendSession = sessions.find((session) => session.id === sessionId);
  const storageKey = `skylab.admin.roster.${eventId}`;

  useEffect(() => {
    setSessionId((current) =>
      sessions.some((session) => session.id === current) ? current : defaultDoorSessionId(sessions),
    );
  }, [sessions]);

  // The list is where it was left when the reader comes back to the tab
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || '{}') as Saved;
      setQuery(typeof saved.query === 'string' ? saved.query : '');
      // The cancelled list is never where a return lands: the active tickets are the default
      setView(ROSTER_VIEWS.some((option) => option.value === saved.view) ? saved.view! : 'all');
      setSort(saved.sort && saved.sort in SORTS ? saved.sort : 'newest');
      setPage(typeof saved.page === 'number' && saved.page > 0 ? saved.page : 1);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
    setSelected(new Set());
    setRestored(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (restored !== storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ query, view, sort, page }));
    } catch {
      // A full or blocked storage only loses the place in the list
    }
  }, [restored, storageKey, query, view, sort, page]);

  const searched = useMemo(
    () =>
      filterApplicantRoster(tickets, people, { query, ticketType: 'all', status: 'all' }, event),
    [tickets, people, query, event],
  );
  const searchedCancelled = useMemo(
    () =>
      filterApplicantRoster(
        cancelledTickets ?? [],
        people,
        { query, ticketType: 'all', status: 'all' },
        event,
      ),
    [cancelledTickets, people, query, event],
  );
  const searchedWaitlisted = useMemo(
    () =>
      filterApplicantRoster(
        waitlistedTickets ?? [],
        people,
        { query, ticketType: 'all', status: 'all' },
        event,
      ),
    [waitlistedTickets, people, query, event],
  );
  // The place in the list is the whole list's, not the search's
  const places = useMemo(() => waitlistPlaces(waitlistedTickets ?? []), [waitlistedTickets]);
  const cancelledView = view === CANCELLED_VIEW.value;
  const waitlistView = view === WAITLIST_VIEW.value;
  const respondentView = view === UNTICKETED_VIEW.value || view === FORMS_PENDING_VIEW.value;
  const apartView = cancelledView || waitlistView || respondentView;
  const counts = rosterViewCounts(searched);
  const unticketed = respondentCounts?.unticketed ?? 0;
  const formsPending = respondentCounts?.formsPending ?? 0;
  const anyTicket =
    tickets.length > 0 ||
    (cancelledTickets?.length ?? 0) > 0 ||
    (waitlistedTickets?.length ?? 0) > 0 ||
    unticketed > 0 ||
    formsPending > 0;
  const rows = useMemo(() => {
    if (view === UNTICKETED_VIEW.value || view === FORMS_PENDING_VIEW.value) return [];
    // The waiting list is served in its own order
    if (view === WAITLIST_VIEW.value) return waitlistOrder(searchedWaitlisted);
    const kept =
      view === CANCELLED_VIEW.value
        ? searchedCancelled
        : searched.filter((ticket) => inRosterView(ticket, view));
    const name = (ticket: Ticket) => ticketRosterRow(ticket, people, event).name;
    const at = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);
    return [...kept].sort((left, right) => {
      if (sort === 'name') return name(left).localeCompare(name(right), 'tr');
      if (sort === 'checkIn') return at(lastCheckInAt(right)) - at(lastCheckInAt(left));
      const order = at(left.createdAt) - at(right.createdAt);
      return sort === 'oldest' ? order : -order;
    });
  }, [searched, searchedCancelled, searchedWaitlisted, view, sort, people, event]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filtered = Boolean(query.trim()) || view !== 'all';

  function pickView(next: ListView) {
    setView(next);
    setPage(1);
    setSelected(new Set());
  }

  function clearFilters() {
    setQuery('');
    pickView('all');
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** The chosen ones, or with none chosen everyone the list shows now. */
  function mailChosen() {
    const chosen = selected.size ? tickets.filter((row) => selected.has(row.id)) : rows;
    onMail(ticketMailRecipients(chosen, people));
  }

  async function attend(ticket: Ticket) {
    if (!onMarkAttended || !attendSession) return;
    setRowErrors(({ [ticket.id]: _gone, ...rest }) => rest);
    const refused = await onMarkAttended(ticket, attendSession.id);
    if (refused) setRowErrors((current) => ({ ...current, [ticket.id]: refused }));
  }

  /** A plain click opens the registration beside the list; a new tab still gets its page. */
  function open(ticket: Ticket) {
    return (click: MouseEvent<HTMLAnchorElement>) => {
      if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey || click.button !== 0)
        return;
      click.preventDefault();
      onOpenTicket(ticket);
    };
  }

  const status = listStatus({
    loading: false,
    failed,
    rowCount: rows.length,
    emptyMessage: emptyListCopy({
      none: cancelledView
        ? 'İptal edilen bilet yok'
        : waitlistView
          ? 'Bekleyen yok'
          : 'Henüz kayıt yok',
      noneMatch: 'Eşleşen kayıt yok',
      query,
      filtered,
    }),
  });

  // The toolbar already offers Katılımcı ekle; an empty search offers its way back
  const emptyAction = filtered ? (
    <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={clearFilters}>
      <X className="size-4" />
      Süzgeci temizle
    </Button>
  ) : null;

  const toolbar = selected.size ? (
    <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
      <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={mailChosen}>
        <Mail className="size-4" />
        E-posta
      </Button>
    </BulkBar>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <div className="max-w-sm min-w-[180px] flex-1">
        <SearchInput
          compact
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Ad, e-posta, bilet kodu"
          aria-label="Katılımcı ara"
        />
      </div>
      {onMarkAttended && sessions.length > 0 && !apartView ? (
        <Select
          aria-label="Giriş oturumu"
          className="w-full sm:w-64"
          value={sessionId}
          onChange={(change) => setSessionId(change.target.value)}
        >
          <option value="">Giriş oturumu seç</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              Giriş: {doorSessionLabel(session)}
            </option>
          ))}
        </Select>
      ) : null}
      {onMarkAttended && sessions.length > 0 && !attendSession && !apartView ? (
        <p className="text-warning text-[13px]/5">Katıldı için oturum seç</p>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {onImport ? (
          <ActionButton
            icon={Upload}
            label="İçe aktar"
            showLabel
            iconOnlyOnPhone
            onClick={onImport}
          />
        ) : null}
        {onAddParticipant ? (
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Katılımcı ekle"
            onClick={onAddParticipant}
          />
        ) : null}
        {renderExport?.({ ticketIds: rows.map((row) => row.id), filtered })}
        {apartView ? null : (
          <ActionButton
            icon={Mail}
            label="E-posta"
            showLabel
            iconOnlyOnPhone
            onClick={mailChosen}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <CapacityStrip
        active={tickets.length}
        capacity={capacity}
        waitlisted={waitlistedTickets?.length ?? 0}
        waitlistOpen={waitlistView}
        onWaitlist={() => pickView('waitlisted')}
      />
      {tickets.length > 0 ? (
        <RosterTiles tickets={tickets} view={apartView ? null : view} onView={pickView} />
      ) : null}
      <div className="space-y-3">
        {toolbar}
        {anyTicket ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 [&_button]:whitespace-nowrap">
              <FilterPills<ListView>
                aria-label="Görünüm"
                value={view}
                onValueChange={pickView}
                options={[
                  ...ROSTER_VIEWS.filter(
                    (option) =>
                      option.value === 'all' || counts[option.value] > 0 || option.value === view,
                  ).map((option) => ({ ...option, count: counts[option.value] })),
                  ...(searchedWaitlisted.length > 0 || waitlistView
                    ? [{ ...WAITLIST_VIEW, count: searchedWaitlisted.length }]
                    : []),
                  ...(searchedCancelled.length > 0 || cancelledView
                    ? [{ ...CANCELLED_VIEW, count: searchedCancelled.length }]
                    : []),
                  ...(respondentCounts &&
                  (unticketed > 0 || respondentCounts.failed || view === UNTICKETED_VIEW.value)
                    ? [
                        {
                          ...UNTICKETED_VIEW,
                          count: respondentCounts.failed ? undefined : unticketed,
                        },
                      ]
                    : []),
                  ...(respondentCounts &&
                  (formsPending > 0 || respondentCounts.failed || view === FORMS_PENDING_VIEW.value)
                    ? [
                        {
                          ...FORMS_PENDING_VIEW,
                          count: respondentCounts.failed ? undefined : formsPending,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            {waitlistView || respondentView ? null : (
              <Select
                aria-label="Sıralama"
                className="ml-auto w-40"
                value={sort}
                onChange={(change) => {
                  setSort(change.target.value as Sort);
                  setPage(1);
                }}
              >
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        ) : null}
        {respondentView && renderRespondents ? (
          renderRespondents(view as RespondentView, query)
        ) : (
          <>
            {failed ? <LoadError title="Kayıtlar yüklenemedi" onRetry={onRetry} /> : null}
            <ListPanel status={status}>
              <ul className="divide-border-subtle divide-y">
                {slice.map((ticket) => (
                  <RosterRow
                    key={ticket.id}
                    ticket={ticket}
                    eventId={eventId}
                    row={ticketRosterRow(ticket, people, event)}
                    current={openTicket?.id === ticket.id}
                    selected={selected.has(ticket.id)}
                    error={rowErrors[ticket.id]}
                    attendSession={attendSession}
                    canAttend={Boolean(onMarkAttended)}
                    onToggle={() => toggle(ticket.id)}
                    onOpen={open(ticket)}
                    onAttend={() => void attend(ticket)}
                    onResend={onResend}
                    onRenew={onRenew}
                    onCancel={onCancel}
                    onRestore={onRestore}
                    onPromote={onPromote}
                    place={places.get(ticket.id)}
                    eventEnded={eventEnded}
                  />
                ))}
              </ul>
            </ListPanel>
            {!failed && rows.length === 0 && emptyAction ? (
              <div className="flex justify-center">{emptyAction}</div>
            ) : null}
            {rows.length ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-subtle-foreground text-xs tabular-nums">
                  {`${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} / ${rows.length}`}
                </p>
                <Pagination current={safePage} totalPages={totalPages} onPageChange={setPage} />
              </div>
            ) : null}
          </>
        )}
      </div>
      {tickets.length > 0 ? <RosterChartsSection tickets={tickets} /> : null}
      <Drawer
        open={openTicket !== null}
        onClose={() => onOpenTicket(null)}
        title={openTicket ? ticketRosterRow(openTicket, people, event).name : 'Kayıt'}
      >
        {openTicket ? (
          <TicketPanel
            ticket={openTicket}
            people={people}
            event={event}
            sessions={sessions}
            attendSession={attendSession}
            error={rowErrors[openTicket.id]}
            onMarkAttended={onMarkAttended ? (ticket) => void attend(ticket) : undefined}
            onResend={onResend}
            onRenew={onRenew}
            onCancel={onCancel}
            onRestore={onRestore}
            onPromote={onPromote}
            eventEnded={eventEnded}
          />
        ) : null}
        {openTicket ? dialogs : null}
      </Drawer>
      {openTicket ? null : dialogs}
    </div>
  );
}

function RosterRow({
  ticket,
  eventId,
  row,
  current,
  selected,
  error,
  attendSession,
  canAttend,
  onToggle,
  onOpen,
  onAttend,
  onResend,
  onRenew,
  onCancel,
  onRestore,
  onPromote,
  place,
  eventEnded,
}: {
  ticket: Ticket;
  eventId: string;
  row: ReturnType<typeof ticketRosterRow>;
  current: boolean;
  selected: boolean;
  error?: string;
  attendSession?: DoorSession;
  canAttend: boolean;
  onToggle: () => void;
  onOpen: (click: MouseEvent<HTMLAnchorElement>) => void;
  onAttend: () => void;
  onResend?: (ticket: Ticket) => void;
  onRenew?: (ticket: Ticket) => void;
  onCancel?: (ticket: Ticket) => void;
  onRestore?: (ticket: Ticket) => void;
  onPromote?: (ticket: Ticket) => void;
  /** The place in the waiting list, for a waitlisted ticket. */
  place?: number;
  eventEnded: boolean;
}) {
  const cancelled = isTicketCancelled(ticket);
  const waiting = ticket.status === 'waitlisted';
  const apart = cancelled || waiting;
  const waited = waiting ? waitedFor(ticket.waitlistedAt ?? ticket.createdAt) : null;
  const waitLabel = waiting ? waitlistLabel(place, waited) : '';
  const shut = cancelShut(ticket, eventEnded);
  // Forms declined the answer after the Ticket: kept until the organizer cancels it (K6)
  // On the waiting list too: its place is the declined answer's
  const rejected =
    !cancelled && Boolean(ticket.formsRejectedAt || ticket.formsStatus === 'declined');
  const formsPending = !cancelled && !rejected && ticket.formsStatus === 'pending';
  const href = `/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(ticket.id)}`;
  const entry = lastCheckInAt(ticket);
  const entryTime = entry ? formatEntry(entry) : null;
  const inSession =
    attendSession && (ticket.checkIns ?? []).some((item) => item.sessionId === attendSession.id);
  return (
    <li
      className={`group/row hover:bg-card flex items-center gap-3 px-3 py-3 transition-colors ${
        current ? 'bg-card' : ''
      }`}
    >
      {apart ? (
        // Nobody to mail: the cancelled list and the waiting list have no choice
        <span className="w-3.5 shrink-0" aria-hidden />
      ) : (
        <input
          type="checkbox"
          className="accent-skylab-400 h-3.5 w-3.5 shrink-0"
          checked={selected}
          aria-label={`${row.name} seç`}
          onChange={onToggle}
        />
      )}
      <Link
        href={href}
        onClick={onOpen}
        aria-label={row.name}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar name={row.name} email={row.email} size="md" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground-strong block truncate text-sm font-medium">
            {row.name}
          </span>
          <span className="text-subtle-foreground block truncate text-[13px]/5">
            {row.email || '—'}
          </span>
          {cancelled && ticket.cancelReason ? (
            <span className="text-muted-foreground block truncate text-[13px]/5">
              Gerekçe: {ticket.cancelReason}
            </span>
          ) : null}
          {rejected ? (
            <span className="text-destructive block truncate text-[13px]/5">
              Forms’ta reddedildi
            </span>
          ) : formsPending ? (
            <span className="text-warning block truncate text-[13px]/5">
              Forms’ta yeniden onay bekliyor
            </span>
          ) : null}
          {/* The status column gives way on phones: said under the name instead */}
          <span className="mt-0.5 flex gap-2 text-[13px]/5 sm:hidden">
            {cancelled ? (
              <span className="text-destructive">{cancelledLabel(ticket)}</span>
            ) : waiting ? (
              <span className="text-warning">{waitLabel}</span>
            ) : entryTime ? (
              <span className="text-success">Giriş {entryTime}</span>
            ) : (
              <span className="text-muted-foreground">Gelmedi</span>
            )}
            {ticket.sent === false && !apart ? (
              <span className="text-warning">Posta gitmedi</span>
            ) : null}
          </span>
          {error ? (
            <span role="alert" className="text-destructive mt-0.5 block text-[13px]/5">
              {error}
            </span>
          ) : null}
        </span>
        <span className="hidden w-40 shrink-0 md:block">
          <span className="text-secondary-foreground block font-mono text-xs tabular-nums">
            {ticket.code || '—'}
          </span>
          <span className="text-subtle-foreground block truncate text-[13px]/5">
            {row.sourceFormLabel} · {row.createdAtLabel}
          </span>
        </span>
        <span className="hidden w-20 shrink-0 sm:block">
          <StatusChip kind={ticketTypeStatus(row.ticketType)} />
        </span>
        <span className="hidden w-36 shrink-0 sm:block">
          {cancelled ? (
            <StatusChip kind="cancelled" label={cancelledLabel(ticket)} />
          ) : waiting ? (
            <StatusChip kind="pending" label={waitLabel} />
          ) : entryTime ? (
            <StatusChip kind="checked-in" label={`Giriş ${entryTime}`} />
          ) : (
            <StatusChip kind="neutral" label="Gelmedi" />
          )}
          {ticket.sent === false && !apart ? (
            <span className="text-warning mt-1 block text-[13px]/5">Posta gitmedi</span>
          ) : null}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {rejected && onCancel ? (
          <Button
            className={BUTTON_TEXT}
            size="xs"
            variant="outline"
            disabled={shut !== null}
            title={shut ?? undefined}
            onClick={() => onCancel(ticket)}
            aria-label={`${row.name}: bileti iptal et`}
          >
            <Ban className="size-3.5" />
            <span className="hidden sm:inline">İptal et</span>
          </Button>
        ) : null}
        {canAttend && !apart ? (
          <Button
            className={BUTTON_TEXT}
            size="xs"
            variant="outline"
            disabled={!attendSession || inSession}
            onClick={onAttend}
            aria-label={`${row.name}: katıldı`}
          >
            <CheckCircle2 className="size-3.5" />
            <span className="hidden sm:inline">{inSession ? 'Girişi var' : 'Katıldı'}</span>
          </Button>
        ) : null}
        {waiting ? (
          <>
            {onPromote ? (
              <Button
                className={BUTTON_TEXT}
                size="xs"
                variant="outline"
                disabled={eventEnded}
                title={eventEnded ? EVENT_OVER : undefined}
                onClick={() => onPromote(ticket)}
                aria-label={`${row.name}: öne al`}
              >
                <ChevronsUp className="size-3.5" />
                <span className="hidden sm:inline">Öne al</span>
              </Button>
            ) : null}
            {onCancel ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <IconButton
                      icon={MoreHorizontal}
                      size="icon-sm"
                      variant="ghost"
                      label={`${row.name}: eylemler`}
                    />
                  }
                />
                <DropdownMenuContent align="end">
                  <MenuItem
                    icon={Ban}
                    destructive
                    disabled={eventEnded}
                    onClick={() => onCancel(ticket)}
                  >
                    Listeden çıkar
                  </MenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        ) : cancelled ? (
          onRestore ? (
            <Button
              className={BUTTON_TEXT}
              size="xs"
              variant="outline"
              disabled={eventEnded}
              title={eventEnded ? EVENT_OVER : undefined}
              onClick={() => onRestore(ticket)}
              aria-label={`${row.name}: iptali geri al`}
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Geri al</span>
            </Button>
          ) : null
        ) : onResend || onRenew || onCancel ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <IconButton
                  icon={MoreHorizontal}
                  size="icon-sm"
                  variant="ghost"
                  label={`${row.name}: eylemler`}
                />
              }
            />
            <DropdownMenuContent align="end">
              {onResend ? (
                <MenuItem icon={Send} onClick={() => onResend(ticket)}>
                  Bileti yeniden gönder
                </MenuItem>
              ) : null}
              {onRenew ? (
                <MenuItem icon={RefreshCw} onClick={() => onRenew(ticket)}>
                  Bağlantıyı yenile
                </MenuItem>
              ) : null}
              {onCancel ? (
                <MenuItem
                  icon={Ban}
                  destructive
                  disabled={shut !== null}
                  onClick={() => onCancel(ticket)}
                >
                  {shut ? (
                    <span>
                      Bileti iptal et
                      <span className="text-muted-foreground block text-xs">{shut}</span>
                    </span>
                  ) : (
                    'Bileti iptal et'
                  )}
                </MenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <ChevronRight className="text-muted-foreground group-hover/row:text-skylab-300 hidden size-4 sm:block" />
      </div>
    </li>
  );
}

/** "Sırada 2 · 3 gün": the place in the waiting list and how long it has waited. */
function waitlistLabel(place: number | undefined, waited: string | null): string {
  const head = place ? `Sırada ${place}` : 'Sırada';
  return waited ? `${head} · ${waited}` : head;
}

/** "İptal · 24 Kas 13:05": when the ticket was cancelled, if core says so. */
function cancelledLabel(ticket: Ticket): string {
  return ticket.cancelledAt ? `İptal · ${formatEntry(ticket.cancelledAt)}` : 'İptal';
}
