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
  Tab,
  Tabs,
  TabsList,
} from '@skylab-kulubu/skylcn-ui';
import {
  CheckCircle2,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Plus,
  QrCode,
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
import type { DesignVariant } from '@/lib/ui/design-variant';
import { RosterCharts, RosterStrip, RosterTiles } from './RosterOverview';
import { TicketPanel } from './TicketPanel';

const PAGE_SIZE = 20;
type Sort = { key: 'name' | 'createdAt' | 'checkIn'; direction: 1 | -1 };

export type ParticipantsDesignProps = {
  variant: DesignVariant;
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
  onMarkAttended?: (ticket: Ticket, sessionId: string) => Promise<string | null>;
  onResend?: (ticket: Ticket) => void;
  onRenew?: (ticket: Ticket) => void;
  /** The page's confirm dialog: inside the drawer while one is open, so it sits above it. */
  dialogs: ReactNode;
};

function useWide(query: string) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return wide;
}

/** The Katılımcılar tab in a trial direction: A summary and roomy list, B dense table. */
export function ParticipantsDesign(props: ParticipantsDesignProps) {
  const {
    variant,
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
  } = props;
  const [query, setQuery] = useState('');
  const [view, setView] = useState<RosterView>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>({ key: 'createdAt', direction: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState(() => defaultDoorSessionId(sessions));
  const [chartsOpen, setChartsOpen] = useState(false);
  const docked = useWide('(min-width: 1280px)') && variant === 'b';
  const attendSession = sessions.find((session) => session.id === sessionId);

  useEffect(() => {
    setSessionId((current) =>
      sessions.some((session) => session.id === current) ? current : defaultDoorSessionId(sessions),
    );
  }, [sessions]);

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
      if (sort.key === 'name') return sort.direction * name(left).localeCompare(name(right), 'tr');
      if (sort.key === 'checkIn')
        return sort.direction * (at(lastCheckInAt(left)) - at(lastCheckInAt(right)));
      return sort.direction * (at(left.createdAt) - at(right.createdAt));
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: Sort['key']) {
    setSort((current) => ({
      key,
      direction:
        current.key === key ? ((current.direction * -1) as 1 | -1) : key === 'name' ? 1 : -1,
    }));
  }

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

  const sessionPicker =
    onMarkAttended && sessions.length > 0 ? (
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
    ) : null;

  const actions = (
    <div className="flex items-center gap-2">
      {onAddParticipant ? (
        <ActionButton
          icon={Plus}
          variant="primary"
          label="Katılımcı ekle"
          onClick={onAddParticipant}
        />
      ) : null}
      <ActionButton icon={Mail} label="Mail" onClick={mailChosen} />
      <ActionButton
        icon={QrCode}
        label="Kapı"
        href={`/qr?eventId=${encodeURIComponent(eventId)}`}
      />
    </div>
  );

  const search = (
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
  );

  const bulk = selected.size ? (
    <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
      <Button size="sm" variant="outline" onClick={mailChosen}>
        <Mail className="size-4" />
        Mail
      </Button>
    </BulkBar>
  ) : null;

  const rowMenu = (ticket: Ticket, name: string) =>
    onResend || onRenew ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              icon={MoreHorizontal}
              size="icon-sm"
              variant="ghost"
              label={`${name}: eylemler`}
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
    ) : null;

  const attendButton = (ticket: Ticket, name: string, compact: boolean) => {
    if (!onMarkAttended) return null;
    const done =
      attendSession &&
      (ticket.checkIns ?? []).some((entry) => entry.sessionId === attendSession.id);
    if (compact) {
      return (
        <IconButton
          icon={CheckCircle2}
          size="icon-sm"
          variant={done ? 'ghost' : 'outline'}
          label={done ? `${name}: girişi var` : `${name}: katıldı`}
          disabled={!attendSession || done}
          onClick={() => void attend(ticket)}
        />
      );
    }
    return (
      <Button
        size="xs"
        variant="outline"
        disabled={!attendSession || done}
        onClick={() => void attend(ticket)}
        aria-label={`${name}: katıldı`}
      >
        <CheckCircle2 className="size-3.5" />
        <span className="hidden sm:inline">{done ? 'Girişi var' : 'Katıldı'}</span>
      </Button>
    );
  };

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
  const emptyAction = filtered ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setQuery('');
        pickView('all');
      }}
    >
      <X className="size-4" />
      Süzgeci temizle
    </Button>
  ) : onAddParticipant ? (
    <Button size="sm" variant="outline" onClick={onAddParticipant}>
      <Plus className="size-4" />
      Katılımcı ekle
    </Button>
  ) : null;

  const listA = (
    <ListPanel status={status}>
      <ul className="divide-border-subtle divide-y">
        {slice.map((ticket) => {
          const row = ticketRosterRow(ticket, people, event);
          const href = `/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(ticket.id)}`;
          const entry = lastCheckInAt(ticket);
          return (
            <li
              key={ticket.id}
              className={`group/row hover:bg-card flex items-center gap-3 px-3 py-3 transition-colors ${
                openTicket?.id === ticket.id ? 'bg-card' : ''
              }`}
            >
              <input
                type="checkbox"
                className="accent-skylab-400 h-3.5 w-3.5 shrink-0"
                checked={selected.has(ticket.id)}
                aria-label={`${row.name} seç`}
                onChange={() => toggle(ticket.id)}
              />
              <Link
                href={href}
                onClick={open(ticket)}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar name={row.name} email={row.email} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground-strong block truncate text-sm font-medium">
                    {row.name}
                  </span>
                  <span className="text-2xs text-subtle-foreground block truncate">
                    {row.email || '—'}
                  </span>
                  {/* The status column gives way on phones: said under the name instead */}
                  <span className="text-3xs mt-0.5 flex gap-2 sm:hidden">
                    {entry ? (
                      <span className="text-success">
                        Giriş {formatClock(entry).split(' ').pop()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Gelmedi</span>
                    )}
                    {ticket.sent === false ? (
                      <span className="text-warning">Bilet gitmedi</span>
                    ) : null}
                  </span>
                  {rowErrors[ticket.id] ? (
                    <span role="alert" className="text-destructive mt-0.5 block text-xs">
                      {rowErrors[ticket.id]}
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
                  {entry ? (
                    <StatusChip
                      kind="checked-in"
                      label={`Giriş ${formatClock(entry).split(' ').pop()}`}
                    />
                  ) : (
                    <StatusChip kind="neutral" label="Gelmedi" />
                  )}
                  {ticket.sent === false ? (
                    <span className="text-3xs text-warning mt-1 block">Bilet gitmedi</span>
                  ) : null}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                {attendButton(ticket, row.name, false)}
                {rowMenu(ticket, row.name)}
                <ChevronRight className="text-muted-foreground group-hover/row:text-skylab-300 hidden size-4 sm:block" />
              </div>
            </li>
          );
        })}
      </ul>
    </ListPanel>
  );

  const head = 'text-2xs text-subtle-foreground font-medium px-2 py-2 text-left';
  const sortHead = (key: Sort['key'], label: string, className = '') => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}
      className={`${head} ${className}`}
    >
      <button type="button" onClick={() => toggleSort(key)} className="hover:text-foreground">
        {label}
        {sort.key === key ? (sort.direction === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
  const narrow = docked && openTicket !== null;
  const allOnPage = slice.length > 0 && slice.every((ticket) => selected.has(ticket.id));
  const listB = (
    <ListPanel status={status}>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-background sticky top-0 z-10">
          <tr className="border-border border-b">
            <th scope="col" className="w-9 px-2 py-2">
              <input
                type="checkbox"
                className="accent-skylab-400 h-3.5 w-3.5"
                checked={allOnPage}
                aria-label="Sayfadakileri seç"
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const ticket of slice) {
                      if (allOnPage) next.delete(ticket.id);
                      else next.add(ticket.id);
                    }
                    return next;
                  })
                }
              />
            </th>
            {sortHead('name', 'Kişi')}
            <th scope="col" className={`${head} hidden ${narrow ? '' : 'lg:table-cell'}`}>
              E-posta
            </th>
            <th scope="col" className={`${head} hidden w-28 md:table-cell`}>
              Bilet kodu
            </th>
            <th scope="col" className={`${head} hidden w-20 sm:table-cell`}>
              Tür
            </th>
            <th scope="col" className={`${head} hidden w-28 2xl:table-cell`}>
              Form
            </th>
            {sortHead('createdAt', 'Kayıt', `hidden w-20 md:table-cell`)}
            {sortHead('checkIn', 'Giriş', 'w-24')}
            <th scope="col" className="w-20 px-2 py-2">
              <span className="sr-only">İşlemler</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border-subtle divide-y">
          {slice.map((ticket) => {
            const row = ticketRosterRow(ticket, people, event);
            const href = `/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(ticket.id)}`;
            const entry = lastCheckInAt(ticket);
            const current = openTicket?.id === ticket.id;
            return (
              <tr
                key={ticket.id}
                className={`hover:bg-card h-10 transition-colors ${current ? 'bg-accent' : ''}`}
              >
                <td className="px-2">
                  <input
                    type="checkbox"
                    className="accent-skylab-400 h-3.5 w-3.5"
                    checked={selected.has(ticket.id)}
                    aria-label={`${row.name} seç`}
                    onChange={() => toggle(ticket.id)}
                  />
                </td>
                <td className="min-w-0 px-2">
                  <Link
                    href={href}
                    onClick={open(ticket)}
                    aria-current={current ? 'true' : undefined}
                    className="text-foreground-strong flex min-w-0 items-center gap-2 font-medium hover:underline"
                  >
                    <Avatar name={row.name} email={row.email} size="sm" />
                    <span className="truncate">{row.name}</span>
                    {ticket.sent === false ? (
                      <span className="text-3xs text-warning hidden shrink-0 sm:inline">
                        bilet gitmedi
                      </span>
                    ) : null}
                  </Link>
                  {rowErrors[ticket.id] ? (
                    <p role="alert" className="text-destructive text-xs">
                      {rowErrors[ticket.id]}
                    </p>
                  ) : null}
                </td>
                <td
                  className={`text-muted-foreground hidden truncate px-2 text-xs ${narrow ? '' : 'lg:table-cell'}`}
                >
                  {row.email || '—'}
                </td>
                <td className="text-secondary-foreground hidden px-2 font-mono text-xs tabular-nums md:table-cell">
                  {ticket.code || '—'}
                </td>
                <td className="hidden px-2 sm:table-cell">
                  <StatusChip kind={ticketTypeStatus(row.ticketType)} />
                </td>
                <td className="text-muted-foreground hidden truncate px-2 text-xs 2xl:table-cell">
                  {row.sourceFormLabel}
                </td>
                <td className="text-subtle-foreground hidden px-2 text-xs tabular-nums md:table-cell">
                  {row.createdAtLabel}
                </td>
                <td className="px-2 text-xs tabular-nums">
                  {entry ? (
                    <span className="text-success">{formatClock(entry).split(' ').pop()}</span>
                  ) : (
                    <span className="text-subtle-foreground">—</span>
                  )}
                </td>
                <td className="px-2">
                  <div className="flex justify-end gap-0.5">
                    {attendButton(ticket, row.name, true)}
                    {rowMenu(ticket, row.name)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ListPanel>
  );

  const panel = openTicket ? (
    <TicketPanel
      ticket={openTicket}
      people={people}
      event={event}
      sessions={sessions}
      attendSession={attendSession}
      showName={docked}
      onMarkAttended={onMarkAttended ? (ticket) => void attend(ticket) : undefined}
      onResend={onResend}
      onRenew={onRenew}
    />
  ) : null;

  const footer =
    rows.length === 0 ? null : (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xs text-subtle-foreground tabular-nums">
          {rows.length
            ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, rows.length)} / ${rows.length}`
            : '0'}
        </p>
        <Pagination current={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    );

  const empty =
    !failed && rows.length === 0 ? <div className="flex justify-center">{emptyAction}</div> : null;

  if (variant === 'a') {
    return (
      <div className="flex flex-col gap-4">
        {tickets.length > 0 ? (
          <RosterTiles tickets={tickets} view={view} onView={pickView} />
        ) : null}
        {tickets.length > 0 ? (
          <div className="order-last lg:order-none">
            <RosterCharts tickets={tickets} />
          </div>
        ) : null}
        <div className="space-y-3">
          {bulk ?? (
            <div className="flex flex-wrap items-center gap-2">
              {search}
              {sessionPicker}
              <div className="ml-auto">{actions}</div>
            </div>
          )}
          <div
            hidden={tickets.length === 0}
            className="-mx-1 overflow-x-auto px-1 pb-1 [&_button]:whitespace-nowrap"
          >
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
          {failed ? <LoadError title="Kayıtlar yüklenemedi" onRetry={onRetry} /> : null}
          {listA}
          {empty}
          {footer}
        </div>
        <Drawer
          open={openTicket !== null}
          onClose={() => onOpenTicket(null)}
          title={openTicket ? ticketRosterRow(openTicket, people, event).name : 'Kayıt'}
        >
          {panel}
          {openTicket ? dialogs : null}
        </Drawer>
        {openTicket ? null : dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.length > 0 ? (
        <RosterStrip
          tickets={tickets}
          chartsOpen={chartsOpen}
          onCharts={() => setChartsOpen((open) => !open)}
        />
      ) : null}
      {chartsOpen ? <RosterCharts tickets={tickets} /> : null}
      <div className={docked && openTicket ? 'grid grid-cols-[minmax(0,1fr)_380px] gap-4' : ''}>
        <div className="min-w-0 space-y-3">
          <Tabs
            hidden={tickets.length === 0}
            value={view}
            onValueChange={(next) => pickView(next as RosterView)}
          >
            <TabsList aria-label="Görünüm">
              {ROSTER_VIEWS.map((option) => (
                <Tab key={option.value} value={option.value}>
                  {option.label}
                  <span className="text-3xs text-subtle-foreground ml-1.5 tabular-nums">
                    {counts[option.value]}
                  </span>
                </Tab>
              ))}
            </TabsList>
          </Tabs>
          {bulk ?? (
            <div className="flex flex-wrap items-center gap-2">
              {search}
              {sessionPicker}
              <div className="ml-auto">{actions}</div>
            </div>
          )}
          {failed ? <LoadError title="Kayıtlar yüklenemedi" onRetry={onRetry} /> : null}
          {listB}
          {empty}
          {footer}
        </div>
        {docked && openTicket ? (
          <aside
            aria-label="Kayıt"
            className="border-border-subtle bg-card sticky top-4 max-h-[calc(100vh-6rem)] self-start overflow-y-auto rounded-lg border p-4"
          >
            <div className="mb-3 flex justify-end">
              <IconButton
                icon={X}
                size="icon-sm"
                variant="ghost"
                label="Kapat"
                onClick={() => onOpenTicket(null)}
              />
            </div>
            {panel}
          </aside>
        ) : null}
      </div>
      {docked ? (
        dialogs
      ) : (
        <>
          <Drawer
            open={openTicket !== null}
            onClose={() => onOpenTicket(null)}
            title={openTicket ? ticketRosterRow(openTicket, people, event).name : 'Kayıt'}
          >
            {panel}
            {openTicket ? dialogs : null}
          </Drawer>
          {openTicket ? null : dialogs}
        </>
      )}
    </div>
  );
}
