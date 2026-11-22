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
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
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
import { defaultDoorSessionId, doorSessionLabel, type DoorSession } from '@/lib/door-check-in';
import { emptyListCopy } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import {
  formatClock,
  inRosterView,
  lastCheckInAt,
  ROSTER_VIEWS,
  rosterViewCounts,
  type RosterView,
} from '@/lib/roster-insights';
import { ticketTypeStatus } from '@/lib/status-chip';
import {
  filterApplicantRoster,
  ticketMailRecipients,
  ticketRosterRow,
  type TicketMailRecipient,
  type TicketSourceEvent,
} from '@/lib/tickets-ui';
import { RosterCharts, RosterTiles } from './RosterOverview';
import { TicketPanel } from './TicketPanel';

const PAGE_SIZE = 20;
const SORTS = {
  newest: 'Yeni kayıt önce',
  oldest: 'Eski kayıt önce',
  name: 'Ada göre',
  checkIn: 'Son giriş önce',
} as const;
type Sort = keyof typeof SORTS;
type Saved = { query?: string; view?: RosterView; sort?: Sort; page?: number };

export type ParticipantRosterProps = {
  eventId: string;
  tickets: Ticket[];
  people: Map<string, Person>;
  event?: TicketSourceEvent | null;
  sessions: readonly DoorSession[];
  failed?: boolean;
  onRetry?: () => void | Promise<unknown>;
  openTicket: Ticket | null;
  onOpenTicket: (ticket: Ticket | null) => void;
  onAddParticipant?: () => void;
  onMail: (recipients: TicketMailRecipient[]) => void;
  /** Writes the entry; a refusal comes back as its text and shows in the row. */
  onMarkAttended?: (ticket: Ticket, sessionId: string) => Promise<string | null>;
  onResend?: (ticket: Ticket) => void;
  onRenew?: (ticket: Ticket) => void;
  /** The page's confirm dialog: inside the drawer while one is open, so it sits above it. */
  dialogs: ReactNode;
};

/**
 * The Katılımcılar tab: figures that open their view, the charts, the list
 * with views, and the registration beside it.
 */
export function ParticipantRoster({
  eventId,
  tickets,
  people,
  event,
  sessions,
  failed,
  onRetry,
  openTicket,
  onOpenTicket,
  onAddParticipant,
  onMail,
  onMarkAttended,
  onResend,
  onRenew,
  dialogs,
}: ParticipantRosterProps) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<RosterView>('all');
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
  const counts = rosterViewCounts(searched);
  const rows = useMemo(() => {
    const kept = searched.filter((ticket) => inRosterView(ticket, view));
    const name = (ticket: Ticket) => ticketRosterRow(ticket, people, event).name;
    const at = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);
    return [...kept].sort((left, right) => {
      if (sort === 'name') return name(left).localeCompare(name(right), 'tr');
      if (sort === 'checkIn') return at(lastCheckInAt(right)) - at(lastCheckInAt(left));
      const order = at(left.createdAt) - at(right.createdAt);
      return sort === 'oldest' ? order : -order;
    });
  }, [searched, view, sort, people, event]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filtered = Boolean(query.trim()) || view !== 'all';

  function pickView(next: RosterView) {
    setView(next);
    setPage(1);
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
      none: 'Henüz kayıt yok',
      noneMatch: 'Eşleşen kayıt yok',
      query,
      filtered,
    }),
  });

  // The toolbar already offers Katılımcı ekle; an empty search offers its way back
  const emptyAction = filtered ? (
    <Button size="sm" variant="outline" onClick={clearFilters}>
      <X className="size-4" />
      Süzgeci temizle
    </Button>
  ) : null;

  const toolbar = selected.size ? (
    <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
      <Button size="sm" variant="outline" onClick={mailChosen}>
        <Mail className="size-4" />
        Mail
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
      {onMarkAttended && sessions.length > 0 ? (
        <Select
          aria-label="Giriş oturumu"
          className="w-full sm:w-64"
          value={sessionId}
          onChange={(change) => setSessionId(change.target.value)}
        >
          <option value="">Giriş oturumu seçin</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              Giriş: {doorSessionLabel(session)}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {onAddParticipant ? (
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Katılımcı ekle"
            onClick={onAddParticipant}
          />
        ) : null}
        <ActionButton icon={Mail} label="Mail" onClick={mailChosen} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {tickets.length > 0 ? <RosterTiles tickets={tickets} view={view} onView={pickView} /> : null}
      {tickets.length > 0 ? (
        // On a phone the list comes first, the charts after it
        <div className="order-last lg:order-none">
          <RosterCharts tickets={tickets} />
        </div>
      ) : null}
      <div className="space-y-3">
        {toolbar}
        {tickets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 [&_button]:whitespace-nowrap">
              <FilterPills
                aria-label="Görünüm"
                value={view}
                onValueChange={pickView}
                options={ROSTER_VIEWS.filter(
                  (option) =>
                    option.value === 'all' || counts[option.value] > 0 || option.value === view,
                ).map((option) => ({ ...option, count: counts[option.value] }))}
              />
            </div>
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
          </div>
        ) : null}
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
              />
            ))}
          </ul>
        </ListPanel>
        {!failed && rows.length === 0 && emptyAction ? (
          <div className="flex justify-center">{emptyAction}</div>
        ) : null}
        {rows.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xs text-subtle-foreground tabular-nums">
              {`${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} / ${rows.length}`}
            </p>
            <Pagination current={safePage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
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
            onMarkAttended={onMarkAttended ? (ticket) => void attend(ticket) : undefined}
            onResend={onResend}
            onRenew={onRenew}
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
}) {
  const href = `/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(ticket.id)}`;
  const entry = lastCheckInAt(ticket);
  const entryTime = entry ? formatClock(entry).split(' ').pop() : null;
  const inSession =
    attendSession && (ticket.checkIns ?? []).some((item) => item.sessionId === attendSession.id);
  return (
    <li
      className={`group/row hover:bg-card flex items-center gap-3 px-3 py-3 transition-colors ${
        current ? 'bg-card' : ''
      }`}
    >
      <input
        type="checkbox"
        className="accent-skylab-400 h-3.5 w-3.5 shrink-0"
        checked={selected}
        aria-label={`${row.name} seç`}
        onChange={onToggle}
      />
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
          <span className="text-2xs text-subtle-foreground block truncate">{row.email || '—'}</span>
          {/* The status column gives way on phones: said under the name instead */}
          <span className="text-3xs mt-0.5 flex gap-2 sm:hidden">
            {entryTime ? (
              <span className="text-success">Giriş {entryTime}</span>
            ) : (
              <span className="text-muted-foreground">Gelmedi</span>
            )}
            {ticket.sent === false ? <span className="text-warning">Bilet gitmedi</span> : null}
          </span>
          {error ? (
            <span role="alert" className="text-destructive mt-0.5 block text-xs">
              {error}
            </span>
          ) : null}
        </span>
        <span className="hidden w-40 shrink-0 md:block">
          <span className="text-secondary-foreground block font-mono text-xs tabular-nums">
            {ticket.code || '—'}
          </span>
          <span className="text-3xs text-subtle-foreground block truncate">
            {row.sourceFormLabel} · {row.createdAtLabel}
          </span>
        </span>
        <span className="hidden w-20 shrink-0 sm:block">
          <StatusChip kind={ticketTypeStatus(row.ticketType)} />
        </span>
        <span className="hidden w-32 shrink-0 sm:block">
          {entryTime ? (
            <StatusChip kind="checked-in" label={`Giriş ${entryTime}`} />
          ) : (
            <StatusChip kind="neutral" label="Gelmedi" />
          )}
          {ticket.sent === false ? (
            <span className="text-3xs text-warning mt-1 block">Bilet gitmedi</span>
          ) : null}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {canAttend ? (
          <Button
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
        {onResend || onRenew ? (
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
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <ChevronRight className="text-muted-foreground group-hover/row:text-skylab-300 hidden size-4 sm:block" />
      </div>
    </li>
  );
}
