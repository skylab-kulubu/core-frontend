'use client';

import { useMemo, useState } from 'react';
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
const ROW_GRID = [
  'grid items-center gap-3',
  'grid-cols-[1.25rem_minmax(0,1fr)_1.5rem]',
  'sm:grid-cols-[1.25rem_minmax(0,1fr)_6.5rem_1.5rem]',
  'md:grid-cols-[1.25rem_minmax(0,1fr)_6.5rem_7rem_1.5rem]',
  'lg:grid-cols-[1.25rem_minmax(0,1.4fr)_5.5rem_7.5rem_6.5rem_5.5rem_1.5rem]',
].join(' ');
const COLUMN_LABEL = 'text-3xs font-medium uppercase tracking-[0.18em] text-neutral-600';

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

  const filtered = useMemo(
    () => filterApplicantRoster(tickets, people, { query, ticketType, status }, event),
    [tickets, people, query, ticketType, status, event],
  );

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
        <div
          className={`sticky top-0 z-10 border-b border-white/10 bg-neutral-900 px-3 pb-2 ${ROW_GRID}`}
        >
          <span />
          <span className={COLUMN_LABEL}>Kişi</span>
          <span className={`hidden text-center sm:block ${COLUMN_LABEL}`}>Tür</span>
          <span className={`hidden md:block ${COLUMN_LABEL}`}>Form</span>
          <span className={`hidden text-center lg:block ${COLUMN_LABEL}`}>Tarih</span>
          <span className={`hidden text-center lg:block ${COLUMN_LABEL}`}>Durum</span>
          <span />
        </div>
        {slice.map((ticket) => {
          const row = ticketRosterRow(ticket, people, event);
          const href = `/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(ticket.id)}`;
          const typeKind = ticketTypeStatus(row.ticketType);
          const statusKind = ticketCheckInStatus(row.status === 'checked-in');
          return (
            <div key={ticket.id} className="group/row relative transition-colors hover:bg-white/3">
              <Link
                href={href}
                className="absolute inset-0 z-0"
                aria-label={row.name}
                tabIndex={-1}
              />
              <div className={`${ROW_GRID} px-3 py-2.5`}>
                <input
                  type="checkbox"
                  className="accent-skylab-400 relative z-10 h-3.5 w-3.5"
                  checked={selected.has(ticket.id)}
                  aria-label={`${row.name} seç`}
                  onChange={() => toggle(ticket.id)}
                />
                <div className="flex min-w-0 items-center gap-3">
                  <StatusDot kind={statusKind} title={row.statusLabel} />
                  <Avatar name={row.name} email={row.email} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-200 transition-colors group-hover/row:text-neutral-50">
                      {row.name}
                    </p>
                    <p className="text-3xs mt-0.5 truncate text-neutral-500">{row.email || '—'}</p>
                  </div>
                </div>
                <span className="hidden justify-center sm:flex">
                  <StatusChip kind={typeKind} />
                </span>
                <span className="text-2xs hidden min-w-0 truncate text-neutral-400 md:block">
                  {row.sourceFormLabel}
                </span>
                <span className="text-2xs hidden text-center text-neutral-500 tabular-nums lg:block">
                  {row.createdAtLabel}
                </span>
                <span className="hidden justify-center lg:flex">
                  <StatusChip kind={statusKind} />
                </span>
                <div className="relative z-10 flex justify-end gap-1">
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
              </div>
            </div>
          );
        })}
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
