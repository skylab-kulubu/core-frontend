import { personLabel } from '@/components/identity/PersonPick';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import { canCheckInForEvent, canWriteEvent, isPrivileged, ownerLevels } from '@/lib/auth/groups';
import { publicShortUrl } from '@/lib/api/urls';
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
  status: 'registered' | 'checked-in';
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

export function canAssignEventTicket(groups: readonly string[], ownerTeam: string): boolean {
  if (isPrivileged(groups)) return true;
  return ownerLevels(groups, ownerTeam).includes('LEADER');
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

export function ticketStatus(row: Ticket): { key: 'registered' | 'checked-in'; label: string } {
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

export function filterApplicantRoster(
  rows: readonly Ticket[],
  people: Map<string, Person>,
  filter: ApplicantRosterFilter,
  event?: TicketSourceEvent | null,
  now = new Date(),
): Ticket[] {
  const q = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.ticketType !== 'all' && row.ticketType !== filter.ticketType) return false;
    const projected = ticketRosterRow(row, people, event, now);
    if (filter.status !== 'all' && projected.status !== filter.status) return false;
    if (!q) return true;
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

export type TicketDetailField = {
  label: string;
  value: string;
  href?: string | null;
};

export type TicketDetailContext = {
  sessions?: readonly { id: string; title: string }[];
  now?: Date;
};

const KNOWN_TICKET_KEYS = new Set([
  'id',
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
  const fields: TicketDetailField[] = [
    { label: 'Ad', value: dash(ticketApplicantName(row, people)) },
    { label: 'E-posta', value: dash(ticketApplicantEmail(row, people)) },
    { label: 'Telefon', value: dash(row.guestPhoneNumber) },
    { label: 'Bilet türü', value: ticketTypeLabel(row.ticketType) },
    { label: 'Kaynak form', value: source.label, href: source.href },
    { label: 'Durum', value: status.label },
  ];
  if (row.ticketType === 'REGISTERED' && row.ownerId) {
    fields.push({
      label: 'Üye',
      value: owner ? personLabel(owner) : row.ownerId,
      href: `/users/${row.ownerId}`,
    });
  }
  fields.push(
    { label: 'Üniversite', value: dash(row.guestUniversity) },
    { label: 'Fakülte', value: dash(row.guestFaculty) },
    { label: 'Bölüm', value: dash(row.guestDepartment) },
    { label: 'Sınıf', value: dash(row.guestGrade) },
    {
      label: 'Mail',
      value: row.sent === true ? 'Evet' : row.sent === false ? 'Hayır' : '—',
    },
    { label: 'Oluşturulma', value: formatApplicantWhen(row.createdAt, now) },
    { label: 'Güncellenme', value: formatApplicantWhen(row.updatedAt, now) },
    { label: 'Bilet', value: row.id },
    { label: 'Etkinlik', value: dash(event?.name || row.event?.name || row.eventId) },
  );
  const checkIns = row.checkIns ?? [];
  if (checkIns.length === 0) {
    fields.push({ label: 'Check-in', value: '—' });
  } else {
    for (const checkIn of checkIns) {
      const sessionTitle = sessions.get(checkIn.sessionId) || checkIn.sessionId;
      fields.push({
        label: 'Check-in',
        value: `${sessionTitle} · ${formatApplicantWhen(checkIn.createdAt, now)}`,
      });
    }
  }
  for (const [key, raw] of Object.entries(row)) {
    if (KNOWN_TICKET_KEYS.has(key)) continue;
    const value = extraFieldValue(raw);
    if (value == null || value === '') continue;
    fields.push({ label: extraFieldLabel(key), value });
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
