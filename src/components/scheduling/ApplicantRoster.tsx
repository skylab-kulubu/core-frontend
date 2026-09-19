'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Mail, Plus, QrCode } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Avatar } from '@/components/chrome/Avatar';
import { ListFooterMeta, ListToolbar } from '@/components/chrome/ListToolbar';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { Select } from '@/components/chrome/Select';
import { StatusChip, StatusDot } from '@/components/chrome/StatusChip';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { emptyListCopy } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { ticketCheckInMix, ticketMix } from '@/lib/panel-charts';
import { ticketCheckInStatus, ticketTypeStatus } from '@/lib/status-chip';
import {
  filterApplicantRoster,
  ticketMailRecipients,
  ticketRosterRow,
  type ApplicantRosterFilter,
  type TicketSourceEvent,
} from '@/lib/tickets-ui';

const PAGE_SIZE = 10;
const COLUMN_LABEL = 'text-3xs font-medium uppercase tracking-[0.18em] text-neutral-600';
type RosterSort = 'name' | 'createdAt' | 'status';
type RosterDensity = 'dense' | 'comfortable';
type PersistedRosterState = {
  query?: string;
  ticketType?: ApplicantRosterFilter['ticketType'];
  status?: ApplicantRosterFilter['status'];
  page?: number;
  selected?: string[];
  sort?: { key: RosterSort; direction: 'ascending' | 'descending' };
};

type ApplicantRosterProps = {
  eventId: string;
  tickets: Ticket[];
  people: Map<string, Person>;
  event?: TicketSourceEvent | null;
  sessions?: readonly { id: string; title: string }[];
  mailHref?: string;
  doorHref?: string;
  loading?: boolean;
  failed?: boolean;
  onMailSelected?: (recipients: ReturnType<typeof ticketMailRecipients>) => void;
  onAddParticipant?: () => void;
  onMarkAttended?: (ticket: Ticket, sessionId: string) => void;
};

export function ApplicantRoster({
  eventId,
  tickets,
  people,
  event,
  mailHref,
  doorHref = '/qr',
  sessions = [],
  loading = false,
  failed = false,
  onMailSelected,
  onAddParticipant,
  onMarkAttended,
}: ApplicantRosterProps) {
  const [query, setQuery] = useState('');
  const [ticketType, setTicketType] = useState<ApplicantRosterFilter['ticketType']>('all');
  const [status, setStatus] = useState<ApplicantRosterFilter['status']>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attendSessionId, setAttendSessionId] = useState(sessions[0]?.id ?? '');
  const [sort, setSort] = useState<{ key: RosterSort; direction: 'ascending' | 'descending' }>({
    key: 'createdAt',
    direction: 'descending',
  });
  const [density, setDensity] = useState<RosterDensity>('dense');
  const [restoredEventId, setRestoredEventId] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('skylab.admin.roster-density');
    if (saved === 'dense' || saved === 'comfortable') setDensity(saved);
  }, []);

  useEffect(() => {
    setQuery('');
    setTicketType('all');
    setStatus('all');
    setPage(1);
    setSelected(new Set());
    setSort({ key: 'createdAt', direction: 'descending' });
    try {
      const raw = window.sessionStorage.getItem(`skylab.admin.roster.${eventId}`);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedRosterState;
        if (typeof saved.query === 'string') setQuery(saved.query);
        if (
          saved.ticketType === 'all' ||
          saved.ticketType === 'GUEST' ||
          saved.ticketType === 'REGISTERED'
        ) {
          setTicketType(saved.ticketType);
        }
        if (
          saved.status === 'all' ||
          saved.status === 'registered' ||
          saved.status === 'checked-in'
        ) {
          setStatus(saved.status);
        }
        if (typeof saved.page === 'number' && saved.page > 0) setPage(saved.page);
        if (Array.isArray(saved.selected)) {
          const ticketIDs = new Set(tickets.map((ticket) => ticket.id));
          setSelected(new Set(saved.selected.filter((id) => ticketIDs.has(id))));
        }
        if (
          saved.sort &&
          ['name', 'createdAt', 'status'].includes(saved.sort.key) &&
          (saved.sort.direction === 'ascending' || saved.sort.direction === 'descending')
        ) {
          setSort(saved.sort);
        }
      }
    } catch {
      window.sessionStorage.removeItem(`skylab.admin.roster.${eventId}`);
    }
    setRestoredEventId(eventId);
  }, [eventId, tickets]);

  useEffect(() => {
    if (restoredEventId !== eventId) return;
    const saved: PersistedRosterState = {
      query,
      ticketType,
      status,
      page,
      selected: [...selected],
      sort,
    };
    window.sessionStorage.setItem(`skylab.admin.roster.${eventId}`, JSON.stringify(saved));
  }, [eventId, page, query, restoredEventId, selected, sort, status, ticketType]);

  const filtered = useMemo(() => {
    const rows = filterApplicantRoster(tickets, people, { query, ticketType, status }, event);
    const direction = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((left, right) => {
      if (sort.key === 'createdAt') {
        const leftTime = Date.parse(left.createdAt || '') || 0;
        const rightTime = Date.parse(right.createdAt || '') || 0;
        return direction * (leftTime - rightTime);
      }
      const leftRow = ticketRosterRow(left, people, event);
      const rightRow = ticketRosterRow(right, people, event);
      if (sort.key === 'status') {
        return direction * leftRow.status.localeCompare(rightRow.status, 'tr');
      }
      return direction * leftRow.name.localeCompare(rightRow.name, 'tr');
    });
  }, [tickets, people, query, ticketType, status, event, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filteredEmpty = Boolean(query.trim()) || ticketType !== 'all' || status !== 'all';
  const mix = ticketMix(filtered);
  const checkIns = ticketCheckInMix(filtered);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function mailRecipients() {
    const chosen = selected.size ? tickets.filter((row) => selected.has(row.id)) : filtered;
    return ticketMailRecipients(chosen, people);
  }

  function toggleSort(key: RosterSort) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending',
    }));
    setPage(1);
  }

  function clearFilters() {
    setQuery('');
    setTicketType('all');
    setStatus('all');
    setPage(1);
  }

  const rowPadding = density === 'dense' ? 'py-2' : 'py-3.5';

  return (
    <div className="space-y-3">
      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder="Ad, e-posta, form"
        searchLabel="Başvuran ara"
      >
        <Select
          aria-label="Bilet türü"
          className="w-32 shrink-0"
          value={ticketType}
          onChange={(e) => {
            setTicketType(e.target.value as ApplicantRosterFilter['ticketType']);
            setPage(1);
          }}
        >
          <option value="all">Tür: hepsi</option>
          <option value="GUEST">Misafir</option>
          <option value="REGISTERED">Üye</option>
        </Select>
        <Select
          aria-label="Durum"
          className="w-36 shrink-0"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ApplicantRosterFilter['status']);
            setPage(1);
          }}
        >
          <option value="all">Durum: hepsi</option>
          <option value="registered">Kayıtlı</option>
          <option value="checked-in">Giriş yaptı</option>
        </Select>
        {onMarkAttended && sessions.length > 0 ? (
          <Select
            aria-label="Oturum"
            className="w-40 shrink-0"
            value={attendSessionId}
            onChange={(e) => setAttendSessionId(e.target.value)}
          >
            <option value="">Oturum</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          aria-label="Satır yoğunluğu"
          className="w-32 shrink-0"
          value={density}
          onChange={(changeEvent) => {
            const next = changeEvent.target.value as RosterDensity;
            setDensity(next);
            window.localStorage.setItem('skylab.admin.roster-density', next);
          }}
        >
          <option value="dense">Yoğun</option>
          <option value="comfortable">Rahat</option>
        </Select>
        {onAddParticipant ? (
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Katılımcı ekle"
            onClick={onAddParticipant}
          />
        ) : null}
        {mailHref || onMailSelected ? (
          <ActionButton
            icon={Mail}
            label="Mail"
            href={onMailSelected ? undefined : mailHref}
            onClick={onMailSelected ? () => onMailSelected(mailRecipients()) : undefined}
          />
        ) : null}
        <ActionButton icon={QrCode} label="Kapı" href={doorHref} />
      </ListToolbar>
      {filteredEmpty ? (
        <div aria-label="Aktif filtreler" className="flex flex-wrap items-center gap-2">
          {query.trim() ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-2xs rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-neutral-300 hover:bg-white/5"
            >
              Arama: {query.trim()} ×
            </button>
          ) : null}
          {ticketType !== 'all' ? (
            <button
              type="button"
              onClick={() => setTicketType('all')}
              className="text-2xs rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-neutral-300 hover:bg-white/5"
            >
              Tür: {ticketType === 'GUEST' ? 'Misafir' : 'Üye'} ×
            </button>
          ) : null}
          {status !== 'all' ? (
            <button
              type="button"
              onClick={() => setStatus('all')}
              className="text-2xs rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-neutral-300 hover:bg-white/5"
            >
              Durum: {status === 'checked-in' ? 'Giriş yaptı' : 'Kayıtlı'} ×
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            className="text-2xs text-skylab-300 rounded-md px-2 py-1 hover:bg-white/5"
          >
            Tümünü temizle
          </button>
        </div>
      ) : null}
      {selected.size ? (
        <div
          role="status"
          aria-label="Seçim özeti"
          className="border-skylab-400/20 bg-skylab-500/5 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
        >
          <span className="text-xs font-medium text-neutral-200">{selected.size} kişi seçildi</span>
          {onMailSelected ? (
            <ActionButton
              icon={Mail}
              label="Seçilenlere mail"
              onClick={() => onMailSelected(mailRecipients())}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-2xs ml-auto rounded-md px-2 py-1 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
          >
            Seçimi temizle
          </button>
        </div>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed,
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Henüz başvuru yok.',
            noneMatch: 'Eşleşen başvuru yok.',
            query,
            filtered: filteredEmpty,
          }),
        })}
        emptyDescription={
          filteredEmpty
            ? 'Arama veya filtreyi temizle.'
            : 'Form veya üye kaydı gelince burada durur.'
        }
      >
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-900">
            <tr className="border-b border-white/10">
              {onMailSelected ? (
                <th scope="col" className="w-10 px-3 pb-2">
                  <span className="sr-only">Seç</span>
                </th>
              ) : null}
              <th
                scope="col"
                aria-sort={sort.key === 'name' ? sort.direction : 'none'}
                className={`${COLUMN_LABEL} pb-2 text-left`}
              >
                <button type="button" onClick={() => toggleSort('name')} className="py-1">
                  Kişi
                </button>
              </th>
              <th
                scope="col"
                className={`hidden w-24 pb-2 text-center sm:table-cell ${COLUMN_LABEL}`}
              >
                Tür
              </th>
              <th
                scope="col"
                className={`hidden w-28 pb-2 text-left md:table-cell ${COLUMN_LABEL}`}
              >
                Form
              </th>
              <th
                scope="col"
                aria-sort={sort.key === 'createdAt' ? sort.direction : 'none'}
                className={`hidden w-24 pb-2 text-center lg:table-cell ${COLUMN_LABEL}`}
              >
                <button type="button" onClick={() => toggleSort('createdAt')} className="py-1">
                  Tarih
                </button>
              </th>
              <th
                scope="col"
                aria-sort={sort.key === 'status' ? sort.direction : 'none'}
                className={`hidden w-24 pb-2 text-center lg:table-cell ${COLUMN_LABEL}`}
              >
                <button type="button" onClick={() => toggleSort('status')} className="py-1">
                  Durum
                </button>
              </th>
              <th scope="col" className={`${onMarkAttended ? 'w-20' : 'w-10'} px-3 pb-2`}>
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {slice.map((ticket) => {
              const row = ticketRosterRow(ticket, people, event);
              const href = `/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(ticket.id)}`;
              const typeKind = ticketTypeStatus(row.ticketType);
              const statusKind = ticketCheckInStatus(row.status === 'checked-in');
              return (
                <tr key={ticket.id} className="group/row transition-colors hover:bg-white/3">
                  {onMailSelected ? (
                    <td className={`w-10 px-3 align-middle ${rowPadding}`}>
                      <input
                        type="checkbox"
                        className="accent-skylab-400 h-3.5 w-3.5"
                        checked={selected.has(ticket.id)}
                        aria-label={`${row.name} seç`}
                        onChange={() => toggle(ticket.id)}
                      />
                    </td>
                  ) : null}
                  <td className={`min-w-0 align-middle ${rowPadding}`}>
                    <Link
                      href={href}
                      aria-label={row.name}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <StatusDot kind={statusKind} title={row.statusLabel} />
                      <Avatar name={row.name} email={row.email} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-200 transition-colors group-hover/row:text-neutral-50">
                          {row.name}
                        </span>
                        <span className="text-3xs mt-0.5 block truncate text-neutral-500">
                          {row.email || '—'}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td
                    className={`hidden w-24 text-center align-middle sm:table-cell ${rowPadding}`}
                  >
                    <StatusChip kind={typeKind} />
                  </td>
                  <td
                    className={`text-2xs hidden w-28 truncate text-neutral-400 md:table-cell ${rowPadding}`}
                  >
                    {row.sourceFormLabel}
                  </td>
                  <td
                    className={`text-2xs hidden w-24 text-center text-neutral-500 tabular-nums lg:table-cell ${rowPadding}`}
                  >
                    {row.createdAtLabel}
                  </td>
                  <td
                    className={`hidden w-24 text-center align-middle lg:table-cell ${rowPadding}`}
                  >
                    <StatusChip kind={statusKind} />
                  </td>
                  <td
                    className={`${onMarkAttended ? 'w-20' : 'w-10'} px-3 align-middle ${rowPadding}`}
                  >
                    <div className="flex justify-end gap-1">
                      {onMarkAttended ? (
                        <ActionButton
                          icon={CheckCircle2}
                          label="Katıldı"
                          disabled={!attendSessionId}
                          onClick={() => {
                            if (!attendSessionId) return;
                            onMarkAttended(ticket, attendSessionId);
                          }}
                        />
                      ) : null}
                      <Link
                        href={href}
                        aria-label="Kaydı aç"
                        className="group-hover/row:text-skylab-300 inline-flex h-6 w-6 items-center justify-center text-neutral-400"
                      >
                        <ChevronRight className="h-4 w-4 transition-transform group-hover/row:translate-x-0.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListPanel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListFooterMeta
          items={[
            { label: 'Başvuru', value: filtered.length },
            { label: 'Giriş', value: checkIns[0]?.count ?? 0 },
            { label: 'Misafir', value: mix[0]?.count ?? 0 },
            { label: 'Üye', value: mix[1]?.count ?? 0 },
          ]}
        />
        <Pagination current={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
