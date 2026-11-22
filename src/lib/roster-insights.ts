import type { Ticket } from '@/lib/api/tickets';

/** The roster's ready-made views, each a filter on top of the search. */
export type RosterView = 'all' | 'waiting' | 'checked-in' | 'guest' | 'member' | 'unsent';

export const ROSTER_VIEWS: readonly { value: RosterView; label: string }[] = [
  { value: 'all', label: 'Hepsi' },
  { value: 'waiting', label: 'Gelmedi' },
  { value: 'checked-in', label: 'Giriş yaptı' },
  { value: 'guest', label: 'Misafir' },
  { value: 'member', label: 'Üye' },
  { value: 'unsent', label: 'Bilet gitmedi' },
];

type RosterTicket = Pick<Ticket, 'ticketType' | 'checkIns' | 'sent'>;

export function hasCheckIn(ticket: Pick<Ticket, 'checkIns'>): boolean {
  return (ticket.checkIns?.length ?? 0) > 0;
}

export function inRosterView(ticket: RosterTicket, view: RosterView): boolean {
  switch (view) {
    case 'waiting':
      return !hasCheckIn(ticket);
    case 'checked-in':
      return hasCheckIn(ticket);
    case 'guest':
      return ticket.ticketType !== 'REGISTERED';
    case 'member':
      return ticket.ticketType === 'REGISTERED';
    case 'unsent':
      return ticket.sent === false;
    default:
      return true;
  }
}

export function rosterViewCounts(tickets: readonly RosterTicket[]): Record<RosterView, number> {
  const counts: Record<RosterView, number> = {
    all: 0,
    waiting: 0,
    'checked-in': 0,
    guest: 0,
    member: 0,
    unsent: 0,
  };
  for (const ticket of tickets) {
    for (const { value } of ROSTER_VIEWS) {
      if (inRosterView(ticket, value)) counts[value] += 1;
    }
  }
  return counts;
}

const DAY_MS = 86_400_000;
const istanbulDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const shortDay = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
});

function dayKey(time: number): string {
  return istanbulDay.format(new Date(time));
}

export type RegistrationDay = {
  /** 'YYYY-MM-DD' in Europe/Istanbul. */
  date: string;
  /** "18 Kas". */
  label: string;
  count: number;
  /** Registrations up to and including this day. */
  total: number;
};

/**
 * Registrations per day from the first one to the last (or today, when it is
 * sooner than `days` after), at most `days` days; the days before the window
 * start the running total.
 */
export function registrationsByDay(
  tickets: ReadonlyArray<Pick<Ticket, 'createdAt'>>,
  now = new Date(),
  days = 30,
): RegistrationDay[] {
  const times = tickets
    .map((ticket) => Date.parse(ticket.createdAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  if (!times.length) return [];
  const last = Math.max(
    times[times.length - 1],
    Math.min(now.getTime(), times[times.length - 1] + 7 * DAY_MS),
  );
  const first = Math.max(times[0], last - (days - 1) * DAY_MS);
  const perDay = new Map<string, number>();
  let before = 0;
  const firstKey = dayKey(first);
  for (const time of times) {
    const key = dayKey(time);
    if (key < firstKey) before += 1;
    else perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const rows: RegistrationDay[] = [];
  let total = before;
  const seen = new Set<string>();
  for (let time = first; dayKey(time) <= dayKey(last); time += DAY_MS) {
    const key = dayKey(time);
    if (seen.has(key)) continue;
    seen.add(key);
    const count = perDay.get(key) ?? 0;
    total += count;
    rows.push({ date: key, label: shortDay.format(new Date(time)), count, total });
  }
  return rows;
}

/** How many registered in the last `days` days, today included. */
export function recentRegistrations(
  tickets: ReadonlyArray<Pick<Ticket, 'createdAt'>>,
  now = new Date(),
  days = 7,
): number {
  const since = now.getTime() - days * DAY_MS;
  return tickets.filter((ticket) => Date.parse(ticket.createdAt) >= since).length;
}

/** The latest entry of a registration, if any. */
export function lastCheckInAt(ticket: Pick<Ticket, 'checkIns'>): string | null {
  let latest: string | null = null;
  for (const checkIn of ticket.checkIns ?? []) {
    if (!latest || Date.parse(checkIn.createdAt) > Date.parse(latest)) latest = checkIn.createdAt;
  }
  return latest;
}

const clock = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "22 Kas 09:12". */
export function formatClock(iso: string): string {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? clock.format(new Date(time)) : '—';
}
