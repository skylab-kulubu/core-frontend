import { personLabel } from '@/components/identity/PersonPick';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { canCheckInForEvent, canWriteEvent, isPrivileged, ownerLevels } from '@/lib/auth/groups';
import { ProblemError } from '@/lib/api/core';
import { publicShortUrl } from '@/lib/api/urls';
import { coreProblemMessage } from '@/lib/core-problems';
import { pad2 } from '@/lib/date-picker';

export type TicketSourceEvent = {
  id?: string;
  name?: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
};

export type TicketRosterRow = {
  id: string;
  name: string;
  email: string;
  ticketType: string;
  ticketTypeLabel: string;
  sourceFormLabel: string;
  sourceFormHref: string | null;
  createdAtLabel: string;
  status: 'registered' | 'checked-in' | 'cancelled';
  statusLabel: string;
};

const MONTHS_TR = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
] as const;

export function canListEventTickets(
  groups: readonly string[],
  ownerTeam: string,
  roles: readonly string[] = [],
): boolean {
  return (
    canWriteEvent(groups, ownerTeam, 'update') ||
    (ownerLevels(groups, ownerTeam).length > 0 && roles.includes('certificate:issue'))
  );
}

/**
 * Apply-for-other, and sending a Ticket again or renewing its link (core
 * docs/ticket-resend.md): the owning team's Leaders, ADMIN and YK
 * (ticket:manage). DK reads, it does not give out Tickets.
 */
export function canAssignEventTicket(groups: readonly string[], ownerTeam: string): boolean {
  if (groups.some((g) => /^\/(UYELER\/)?(ADMIN|YK)(\/|$)/.test(g))) return true;
  return ownerLevels(groups, ownerTeam).includes('LEADER');
}

/**
 * Cancelling a Ticket and taking it back (core docs/ticket-cancellation.md): exactly who edits
 * the Event, ADMIN and YK, its team's Leaders, GECEKODU's members. DK reads only. The group
 * rule stands in when core's capabilities (`event.update`) cannot be read.
 */
export function canCancelEventTicket(groups: readonly string[], ownerTeam: string): boolean {
  if (groups.some((g) => /^\/(UYELER\/)?(ADMIN|YK)(\/|$)/.test(g))) return true;
  const levels = ownerLevels(groups, ownerTeam);
  return ownerTeam === 'GECEKODU' ? levels.length > 0 : levels.includes('LEADER');
}

export function canDeskCheckIn(
  groups: readonly string[],
  ownerTeam: string,
  userId?: string,
  doorStaffIds: readonly string[] = [],
): boolean {
  return canCheckInForEvent(groups, ownerTeam, userId, doorStaffIds);
}

export function ticketOwnerPeople(rows: readonly Ticket[]): Map<string, Person> {
  return new Map(
    rows.flatMap((ticket) =>
      ticket.owner
        ? [
            [
              ticket.owner.id,
              {
                id: ticket.owner.id,
                email: ticket.owner.email,
                firstName: ticket.owner.firstName,
                lastName: ticket.owner.lastName,
              },
            ] as const,
          ]
        : [],
    ),
  );
}

function guestName(row: Ticket): string {
  return [row.guestFirstName, row.guestLastName].filter(Boolean).join(' ');
}

function ownerPerson(row: Ticket, people: Map<string, Person>): Person | undefined {
  if (row.ownerId && people.has(row.ownerId)) return people.get(row.ownerId);
  if (row.owner) return row.owner;
  return undefined;
}

export function ticketApplicantName(row: Ticket, people: Map<string, Person>): string {
  if (row.ticketType === 'GUEST') return guestName(row) || row.guestEmail || row.id;
  const owner = ownerPerson(row, people);
  if (owner) return personLabel(owner);
  return row.ownerId || row.id;
}

/**
 * The applicant as the trail and the browser tab name them: the name alone, never the
 * e-mail address or an id, which the tab and the history would keep.
 */
export function ticketCrumbName(row: Ticket, people: Map<string, Person>): string {
  if (row.ticketType === 'GUEST') return guestName(row) || 'Başvuru';
  const owner = ownerPerson(row, people);
  const name = owner ? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() : '';
  return name || 'Başvuru';
}

export function ticketApplicantEmail(row: Ticket, people: Map<string, Person>): string {
  if (row.ticketType === 'GUEST') return row.guestEmail || '';
  return ownerPerson(row, people)?.email || '';
}

export function ticketApplicantLabel(row: Ticket, people: Map<string, Person>): string {
  const name = ticketApplicantName(row, people);
  const email = ticketApplicantEmail(row, people);
  if (name && email && name !== email) return `${name} · ${email}`;
  return name || email || row.id;
}

export function ticketTypeLabel(ticketType: string): string {
  if (ticketType === 'GUEST') return 'Misafir';
  if (ticketType === 'REGISTERED') return 'Üye';
  return ticketType;
}

export function ticketStatus(row: Ticket): {
  key: 'registered' | 'checked-in' | 'cancelled';
  label: string;
} {
  if (row.status === 'cancelled') return { key: 'cancelled', label: 'İptal edildi' };
  if ((row.checkIns?.length ?? 0) > 0) return { key: 'checked-in', label: 'Giriş yaptı' };
  return { key: 'registered', label: 'Kayıtlı' };
}

export function formatApplicantWhen(iso: string, now = new Date()): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (dayDiff === 0) return `Bugün, ${time}`;
  if (dayDiff === 1) return `Dün, ${time}`;
  const month = MONTHS_TR[date.getMonth()] ?? '';
  const day = pad2(date.getDate());
  if (date.getFullYear() === now.getFullYear()) return `${day} ${month}`;
  return `${day} ${month} ${date.getFullYear()}`;
}

export function ticketSourceForm(
  row: Ticket,
  event?: TicketSourceEvent | null,
): { label: string; href: string | null } {
  if (row.formAlias) {
    return { label: 'Başvuru formu', href: publicShortUrl(row.formAlias) };
  }
  if (row.formUrl) {
    return { label: 'Başvuru formu', href: row.formUrl };
  }
  if (row.ticketType === 'REGISTERED') {
    return { label: 'Üye kaydı', href: null };
  }
  if (event?.formAlias) {
    return { label: 'Başvuru formu', href: publicShortUrl(event.formAlias) };
  }
  if (event?.formUrl) {
    return { label: 'Başvuru formu', href: event.formUrl };
  }
  const extra = event?.extraFormUrls?.[0];
  if (extra?.alias) return { label: extra.label || 'Form', href: publicShortUrl(extra.alias) };
  if (extra?.url) return { label: extra.label || 'Form', href: extra.url };
  return { label: '—', href: null };
}

export type ApplicantRosterFilter = {
  query: string;
  ticketType: 'all' | 'GUEST' | 'REGISTERED';
  status: 'all' | 'registered' | 'checked-in';
};

/**
 * A Ticket code as core reads it at the desk (docs/ticket-access-key-and-code.md):
 * dashes and spaces dropped, upper case, O read as 0, I and L as 1 (ı and İ too).
 */
export function normalizeTicketCode(raw: string): string {
  return raw
    .replace(/[\s-]/g, '')
    .replace(/[ıİ]/g, 'I')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function filterApplicantRoster(
  rows: readonly Ticket[],
  people: Map<string, Person>,
  filter: ApplicantRosterFilter,
  event?: TicketSourceEvent | null,
  now = new Date(),
): Ticket[] {
  const q = filter.query.trim().toLowerCase();
  const code = normalizeTicketCode(filter.query);
  return rows.filter((row) => {
    if (filter.ticketType !== 'all' && row.ticketType !== filter.ticketType) return false;
    const projected = ticketRosterRow(row, people, event, now);
    if (filter.status !== 'all' && projected.status !== filter.status) return false;
    if (!q) return true;
    if (code.length >= 4 && normalizeTicketCode(row.code ?? '').includes(code)) return true;
    return [
      projected.name,
      projected.email,
      projected.ticketTypeLabel,
      projected.sourceFormLabel,
      row.id,
    ]
      .join('\n')
      .toLowerCase()
      .includes(q);
  });
}

export function ticketRosterRow(
  row: Ticket,
  people: Map<string, Person>,
  event?: TicketSourceEvent | null,
  now = new Date(),
): TicketRosterRow {
  const status = ticketStatus(row);
  const source = ticketSourceForm(row, event);
  return {
    id: row.id,
    name: ticketApplicantName(row, people),
    email: ticketApplicantEmail(row, people),
    ticketType: row.ticketType,
    ticketTypeLabel: ticketTypeLabel(row.ticketType),
    sourceFormLabel: source.label,
    sourceFormHref: source.href,
    createdAtLabel: formatApplicantWhen(row.createdAt, now),
    status: status.key,
    statusLabel: status.label,
  };
}

/** Where a field sits in the ticket's detail: who, the ticket, entries, the form's other answers. */
export type TicketDetailGroup = 'Kişi' | 'Bilet' | 'Giriş' | 'Formdaki diğer cevaplar';

export type TicketDetailField = {
  label: string;
  value: string;
  href?: string | null;
  group: TicketDetailGroup;
};

export type TicketDetailContext = {
  sessions?: readonly { id: string; title: string }[];
  now?: Date;
};

const KNOWN_TICKET_KEYS = new Set([
  'id',
  'code',
  'eventId',
  'ticketType',
  'ownerId',
  'owner',
  'guestFirstName',
  'guestLastName',
  'guestEmail',
  'guestPhoneNumber',
  'guestUniversity',
  'guestFaculty',
  'guestDepartment',
  'guestGrade',
  'sent',
  'formId',
  'formUrl',
  'formAlias',
  'checkIns',
  'createdAt',
  'updatedAt',
  'event',
  // The ticket's status (core docs/ticket-cancellation.md): said by its badge, not as an answer
  'status',
  'statusChangedAt',
  'waitlistedAt',
  'cancelledAt',
  'cancelledBy',
  'cancelReason',
]);

function dash(value: string | undefined | null): string {
  const text = (value ?? '').trim();
  return text || '—';
}

function extraFieldLabel(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function extraFieldValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ticketDetailFields(
  row: Ticket,
  people: Map<string, Person>,
  event?: TicketSourceEvent | null,
  ctx: TicketDetailContext = {},
): TicketDetailField[] {
  const now = ctx.now ?? new Date();
  const sessions = new Map((ctx.sessions ?? []).map((session) => [session.id, session.title]));
  const source = ticketSourceForm(row, event);
  const status = ticketStatus(row);
  const owner = ownerPerson(row, people);
  const person = (label: string, value: string, href?: string): TicketDetailField => ({
    label,
    value,
    href,
    group: 'Kişi',
  });
  const ticket = (label: string, value: string, href?: string | null): TicketDetailField => ({
    label,
    value,
    href,
    group: 'Bilet',
  });
  const fields: TicketDetailField[] = [
    person('Ad', dash(ticketApplicantName(row, people))),
    person('E-posta', dash(ticketApplicantEmail(row, people))),
    person('Telefon', dash(row.guestPhoneNumber)),
  ];
  if (row.ticketType === 'REGISTERED' && row.ownerId) {
    fields.push(person('Üye', owner ? personLabel(owner) : row.ownerId, `/users/${row.ownerId}`));
  }
  fields.push(
    person('Üniversite', dash(row.guestUniversity)),
    person('Fakülte', dash(row.guestFaculty)),
    person('Bölüm', dash(row.guestDepartment)),
    person('Sınıf', dash(row.guestGrade)),
    ticket('Bilet kodu', dash(row.code)),
    ticket('Bilet türü', ticketTypeLabel(row.ticketType)),
    ticket('Durum', status.label),
    ticket('Kaynak form', source.label, source.href),
    ticket('Bilet e-postası', row.sent === true ? 'Evet' : row.sent === false ? 'Hayır' : '—'),
    ticket('Oluşturulma', formatApplicantWhen(row.createdAt, now)),
    ticket('Güncellenme', formatApplicantWhen(row.updatedAt, now)),
    ticket('Etkinlik', dash(event?.name || row.event?.name || row.eventId)),
  );
  const checkIns = row.checkIns ?? [];
  if (checkIns.length === 0) {
    fields.push({ label: 'Giriş', value: '—', group: 'Giriş' });
  } else {
    for (const checkIn of checkIns) {
      const sessionTitle = sessions.get(checkIn.sessionId) || checkIn.sessionId;
      fields.push({
        label: sessionTitle,
        value: formatApplicantWhen(checkIn.createdAt, now),
        group: 'Giriş',
      });
    }
  }
  for (const [key, raw] of Object.entries(row)) {
    if (KNOWN_TICKET_KEYS.has(key)) continue;
    const value = extraFieldValue(raw);
    if (value == null || value === '') continue;
    fields.push({ label: extraFieldLabel(key), value, group: 'Formdaki diğer cevaplar' });
  }
  return fields;
}

export type TicketMailRecipient = {
  ticketId: string;
  name: string;
  email: string;
};

export function ticketMailRecipients(
  rows: readonly Ticket[],
  people: Map<string, Person>,
): TicketMailRecipient[] {
  const recipients: TicketMailRecipient[] = [];
  for (const row of rows) {
    const email = ticketApplicantEmail(row, people).trim();
    if (!email) continue;
    recipients.push({
      ticketId: row.id,
      name: ticketApplicantName(row, people),
      email,
    });
  }
  return recipients;
}

/**
 * Why core refused "Bileti yeniden gönder" or "Bağlantıyı yenile": the
 * panel's sentence for the code, an ended Event in the Ticket's words.
 */
export function ticketSendProblem(error: unknown, fallback: string): string {
  if (error instanceof ProblemError && error.code === 'event_ended') {
    return 'Etkinlik bitmiş; bilet gönderilmez.';
  }
  return coreProblemMessage(error, fallback);
}

/** Whether core counts the Ticket as cancelled; a Ticket from before core #405 has no status. */
export function isTicketCancelled(row: Pick<Ticket, 'status'>): boolean {
  return row.status === 'cancelled';
}

/**
 * Why core refused "Bileti iptal et" or "Geri al" (core docs/ticket-cancellation.md): an ended
 * Event, an entry, a Competition entrant, a waitlisted Ticket, or no right to edit the Event.
 */
export function ticketCancelProblem(error: unknown, action: 'cancel' | 'restore'): string {
  const verb = action === 'cancel' ? 'iptal edilemez' : 'geri alınamaz';
  if (error instanceof ProblemError) {
    if (error.code === 'event_ended') return `Etkinlik bitmiş; bilet ${verb}.`;
    if (error.code === 'ticket_waitlisted') return `Bilet bekleme listesinde; ${verb}.`;
    if (error.status === 403) {
      return action === 'cancel'
        ? 'Bu bileti iptal etme yetkin yok.'
        : 'Bu bileti geri alma yetkin yok.';
    }
  }
  return coreProblemMessage(
    error,
    action === 'cancel' ? 'Bilet iptal edilemedi' : 'İptal geri alınamadı',
  );
}
