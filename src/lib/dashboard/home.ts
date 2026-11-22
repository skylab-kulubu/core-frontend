import type {
  DashboardHome,
  DashboardSummary,
  MissingPart,
  Period,
  WeekEvent,
  WeekSession,
} from '@/lib/api/dashboard';
import { canWriteEvent, isPrivileged } from '@/lib/auth/groups';

const DAY = 24 * 60 * 60 * 1000;
const ZONE = 'Europe/Istanbul';

export type TodoTone = 'danger' | 'warning' | 'neutral';

/** One thing waiting on the reader, and where it is done. */
export type TodoRow = {
  key: string;
  title: string;
  detail?: string;
  href: string;
  tone: TodoTone;
};

/** One line of the week: a Session, or an Event with no Session that day. */
export type WeekRow = {
  key: string;
  href: string;
  /** "18:00", or "Sürüyor" for an Event that began on an earlier day. */
  time: string;
  title: string;
  subtitle: string;
  live: boolean;
};

export type WeekDay = { date: string; label: string; rows: WeekRow[] };

export type NumberRow = {
  key: string;
  label: string;
  href?: string;
  current: number;
  previous: number;
};

/** The page's three parts; null where the reader has nothing of that kind. */
export type HomeView = {
  todo: TodoRow[] | null;
  week: WeekDay[];
  numbers: NumberRow[] | null;
  /** True when core is older and the page made what it could from the summary. */
  fallback: boolean;
};

const MISSING_LABEL: Record<MissingPart, string> = {
  location: 'yer yok',
  form: 'form yok',
  sessions: 'program yok',
};

const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: ZONE });

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });

function startLabel(iso: string | undefined, now: Date): string {
  if (!iso) return 'Tarihsiz';
  const date = new Date(iso);
  const key = dayKey(date);
  if (key === dayKey(now)) return `Bugün ${timeOf(iso)}`;
  if (key === dayKey(new Date(now.getTime() + DAY))) return `Yarın ${timeOf(iso)}`;
  return date.toLocaleDateString('tr-TR', { timeZone: ZONE, day: 'numeric', month: 'short' });
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}

/** The to-do rows, most pressing first: data subject requests past due, failed certificates, gaps, drafts. */
export function todoRows(todo: DashboardHome['todo'], now = new Date()): TodoRow[] | null {
  if (!todo) return null;
  const rows: TodoRow[] = [];
  const requests = todo.subjectRequests;
  if (requests && requests.open > 0) {
    rows.push({
      key: 'subject-requests',
      title: `${requests.open} KVKK başvurusu yanıt bekliyor`,
      detail: requests.overdue > 0 ? `${requests.overdue} tanesinin süresi geçti` : undefined,
      href: '/subject-requests',
      tone: requests.overdue > 0 ? 'danger' : 'warning',
    });
  }
  for (const item of todo.failedCertificates) {
    rows.push({
      key: `certificates-${item.eventId}`,
      title: `${item.eventName}: ${item.failed} sertifika basılamadı`,
      href: `/events/${item.eventId}/certificates`,
      tone: 'danger',
    });
  }
  for (const item of todo.incomplete) {
    const missing = item.missing.map((part) => MISSING_LABEL[part]).join(', ');
    rows.push({
      key: `incomplete-${item.id}`,
      title: item.name,
      detail: `${item.live ? 'Sürüyor' : startLabel(item.startDate, now)} · ${capitalize(missing)}`,
      // A missing program is fixed on the Program tab; a place or a form in the editor
      href:
        item.missing.length === 1 && item.missing[0] === 'sessions'
          ? `/events/${item.id}/program`
          : `/events/${item.id}`,
      tone: 'warning',
    });
  }
  if (todo.drafts.length > 3) {
    rows.push({
      key: 'drafts',
      title: `${todo.drafts.length} taslak etkinlik yayında değil`,
      href: '/events?status=draft',
      tone: 'neutral',
    });
  } else {
    for (const draft of todo.drafts) {
      rows.push({
        key: `draft-${draft.id}`,
        title: draft.name,
        detail: `Taslak · ${startLabel(draft.startDate, now)}`,
        href: `/events/${draft.id}`,
        tone: 'neutral',
      });
    }
  }
  return rows;
}

/** The seven days from today, each with its Sessions and the Events that have none that day. */
export function weekDays(week: DashboardHome['week'], now = new Date()): WeekDay[] {
  const days: WeekDay[] = [];
  const index = new Map<string, WeekDay>();
  const today = dayKey(now);
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getTime() + i * DAY);
    const key = dayKey(date);
    const label =
      i === 0
        ? 'Bugün'
        : i === 1
          ? 'Yarın'
          : capitalize(
              date.toLocaleDateString('tr-TR', {
                timeZone: ZONE,
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }),
            );
    const day = { date: key, label, rows: [] as WeekRow[] };
    days.push(day);
    index.set(key, day);
  }
  const events = new Map(week.events.map((event) => [event.id, event]));
  const withSessions = new Set<string>();
  for (const session of week.sessions) {
    const key = dayKey(new Date(session.startTime));
    const day = index.get(key);
    if (!day) continue;
    withSessions.add(`${session.eventId}|${key}`);
    day.rows.push(sessionRow(session, events.get(session.eventId), now));
  }
  for (const event of week.events) {
    if (!event.startDate) continue;
    const startKey = dayKey(new Date(event.startDate));
    // An Event that began before today and still runs shows today, as running
    const key = startKey < today ? (event.live ? today : null) : startKey;
    if (!key || withSessions.has(`${event.id}|${key}`)) continue;
    index.get(key)?.rows.push(eventRow(event, startKey < today));
  }
  for (const day of days) day.rows.sort(byTime);
  return days.filter((day) => day.rows.length > 0);
}

function byTime(a: WeekRow, b: WeekRow): number {
  if (a.time === 'Sürüyor') return -1;
  if (b.time === 'Sürüyor') return 1;
  return a.time.localeCompare(b.time);
}

function sessionRow(session: WeekSession, event: WeekEvent | undefined, now: Date): WeekRow {
  const start = Date.parse(session.startTime);
  const end = session.endTime ? Date.parse(session.endTime) : start + 60 * 60 * 1000;
  return {
    key: `session-${session.id}`,
    href: `/events/${session.eventId}/program`,
    time: timeOf(session.startTime),
    title: session.title,
    subtitle: [session.eventName, event?.location].filter(Boolean).join(' · '),
    live: start <= now.getTime() && now.getTime() <= end,
  };
}

function eventRow(event: WeekEvent, running: boolean): WeekRow {
  return {
    key: `event-${event.id}`,
    href: `/events/${event.id}`,
    time: running ? 'Sürüyor' : timeOf(event.startDate ?? ''),
    title: event.name,
    subtitle: [event.ownerTeam, event.location].filter(Boolean).join(' · '),
    live: event.live,
  };
}

/** The last 30 days against the 30 before; new members only for who may read people. */
export function numberRows(compare: DashboardHome['compare']): NumberRow[] | null {
  if (!compare) return null;
  const rows: NumberRow[] = [
    { key: 'applications', label: 'Başvuru', href: '/events', ...compare.applications },
    { key: 'attendees', label: 'Katılan', href: '/events', ...compare.attendees },
    { key: 'events', label: 'Etkinlik', href: '/events?status=past', ...compare.events },
  ];
  if (compare.newMembers) {
    rows.push({ key: 'new-members', label: 'Yeni üye', href: '/users', ...compare.newMembers });
  }
  return rows;
}

/** "+%60", "−%28", "%0"; null when there is nothing to set it against. */
export function changeLabel({ current, previous }: Period): string | null {
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return '%0';
  return `${change > 0 ? '+' : '−'}%${Math.abs(change)}`;
}

/** A DK-only reader: sees every team's Events but edits none. */
function readsOnly(groups: readonly string[]): boolean {
  return isPrivileged(groups) && !groups.some((g) => /^\/(UYELER\/)?(ADMIN|YK)(\/|$)/.test(g));
}

/**
 * What an older core's summary (no `home`) still tells: the drafts and the
 * Events of today and tomorrow without a place or a form among the covered
 * Events, and their week. No Sessions and no figures.
 */
function fallbackHome(
  summary: DashboardSummary,
  groups: readonly string[],
  now: Date,
): DashboardHome {
  const editable = (team: string) => !readsOnly(groups) && canWriteEvent(groups, team, 'update');
  const stats = summary.eventStats;
  // Today and tomorrow, as days in Istanbul
  const tomorrow = dayKey(new Date(now.getTime() + DAY));
  const soon = (iso: string | undefined) =>
    Boolean(iso) &&
    Date.parse(iso ?? '') >= now.getTime() &&
    dayKey(new Date(iso ?? '')) <= tomorrow;
  const todoAllowed = stats.some((stat) => editable(stat.ownerTeam));
  const weekEnd = now.getTime() + 7 * DAY;
  return {
    todo: todoAllowed
      ? {
          drafts: stats
            .filter((stat) => stat.status === 'draft' && editable(stat.ownerTeam))
            .map(({ id, name, ownerTeam, startDate }) => ({ id, name, ownerTeam, startDate })),
          incomplete: stats
            .filter(
              (stat) =>
                stat.status !== 'draft' &&
                stat.status !== 'cancelled' &&
                editable(stat.ownerTeam) &&
                (stat.live || soon(stat.startDate)),
            )
            .map((stat) => ({
              id: stat.id,
              name: stat.name,
              ownerTeam: stat.ownerTeam,
              startDate: stat.startDate,
              live: stat.live,
              missing: [
                ...(stat.location ? [] : (['location'] as const)),
                ...(stat.hasApplicationForm ? [] : (['form'] as const)),
              ],
            }))
            .filter((item) => item.missing.length > 0),
          failedCertificates: [],
          subjectRequests: null,
        }
      : null,
    week: {
      from: now.toISOString(),
      to: new Date(weekEnd).toISOString(),
      events: stats
        .filter(
          (stat) =>
            stat.status !== 'draft' &&
            stat.status !== 'cancelled' &&
            (stat.live ||
              (Date.parse(stat.startDate ?? '') >= now.getTime() - DAY &&
                Date.parse(stat.startDate ?? '') < weekEnd)),
        )
        .map(({ id, name, ownerTeam, location, startDate, endDate, live }) => ({
          id,
          name,
          ownerTeam,
          location,
          startDate,
          endDate,
          live,
        })),
      sessions: [],
    },
    compare: null,
  };
}

/** The page from the summary; from what an older core gives when it has no `home`. */
export function homeView(
  summary: DashboardSummary,
  groups: readonly string[],
  now = new Date(),
): HomeView {
  const home = summary.home ?? fallbackHome(summary, groups, now);
  return {
    todo: todoRows(home.todo, now),
    week: weekDays(home.week, now),
    numbers: numberRows(home.compare),
    fallback: !summary.home,
  };
}
