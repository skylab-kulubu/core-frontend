import type { DashboardHome, DashboardSummary, EventStat, Period } from '@/lib/api/dashboard';
import { changeLabel } from './home';

const ZONE = 'Europe/Istanbul';

/** "Kas", "Oca": a 'YYYY-MM' month as a short Turkish label. */
export function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  if (!year || !index) return month;
  return new Date(Date.UTC(year, index - 1, 15)).toLocaleDateString('tr-TR', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "3 Kas": a 'YYYY-MM-DD' day as a short Turkish label. */
export function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    timeZone: ZONE,
  });
}

export type Kpi = {
  key: string;
  label: string;
  value: number;
  /** "+%35" against the period before; absent without one. */
  delta?: string;
  hint: string;
  trend?: number[];
  href?: string;
};

const fmt = (n: number) => n.toLocaleString('tr-TR');

function compared(period: Period): Pick<Kpi, 'value' | 'delta' | 'hint'> {
  return {
    value: period.current,
    delta: changeLabel(period) ?? undefined,
    hint: `Önceki 30 gün: ${fmt(period.previous)}`,
  };
}

/** The figures row: each against the 30 days before where core gives it, with a short trend. */
export function kpis(summary: DashboardSummary, home: DashboardHome | undefined): Kpi[] {
  const out: Kpi[] = [];
  const cmp = home?.compare;
  const daily = home?.daily ?? [];
  const last30 = daily.slice(-30);
  if (cmp && summary.ownerTeams.length > 0) {
    out.push({
      key: 'applications',
      label: 'Başvuru',
      ...compared(cmp.applications),
      trend: last30.map((d) => d.applications),
      href: '/events',
    });
    out.push({
      key: 'attendees',
      label: 'Katılım',
      ...compared(cmp.attendees),
      trend: last30.map((d) => d.attendees),
      href: '/events',
    });
    out.push({
      key: 'events',
      label: 'Etkinlik',
      ...compared(cmp.events),
      trend: home?.monthly.map((m) => m.events),
      href: '/events?status=past',
    });
  } else if (summary.ownerTeams.length > 0) {
    // An older core: totals without a period before
    out.push({
      key: 'applications',
      label: 'Başvuru',
      value: summary.applications.daily.reduce((n, d) => n + d.count, 0),
      hint: 'Son 30 gün',
      trend: summary.applications.daily.map((d) => d.count),
      href: '/events',
    });
    out.push({
      key: 'events',
      label: 'Etkinlik',
      value: summary.events.total,
      hint: `${fmt(summary.events.upcoming)} yaklaşan`,
      trend: summary.events.byMonth.map((m) => m.count),
      href: '/events',
    });
  }
  if (home && summary.ownerTeams.length > 0) {
    out.push({
      key: 'sessions',
      label: 'Oturum',
      value: home.sessions,
      hint: 'Etkinlik programlarında',
      href: '/events',
    });
  }
  if (home?.certificates) {
    out.push({
      key: 'certificates',
      label: 'Sertifika',
      ...compared(home.certificates.period),
      hint: `Önceki 30 gün: ${fmt(home.certificates.period.previous)} · toplam ${fmt(home.certificates.issued)}`,
    });
  }
  if (cmp?.newMembers) {
    out.push({
      key: 'new-members',
      label: 'Yeni üye',
      ...compared(cmp.newMembers),
      trend: summary.members?.newByMonth.map((m) => m.count),
      href: '/users',
    });
  }
  if (summary.members) {
    out.push({
      key: 'active-members',
      label: 'Aktif üye',
      value: summary.members.active,
      hint: 'Kayıtlı ve etkin',
      href: '/users',
    });
  }
  return out;
}

export type DailyRow = { day: string; current: number; previous: number | null };

/**
 * The last 30 days against the 30 before, day by day: the previous period's
 * day N sits under this period's day N. From an older core only this period.
 */
export function dailyComparison(
  summary: DashboardSummary,
  home: DashboardHome | undefined,
  pick: 'applications' | 'attendees',
): DailyRow[] {
  const daily = home?.daily ?? [];
  if (daily.length >= 60) {
    const previous = daily.slice(0, 30);
    return daily.slice(30).map((d, i) => ({
      day: dayLabel(d.date),
      current: d[pick],
      previous: previous[i][pick],
    }));
  }
  if (pick === 'attendees') return [];
  return summary.applications.daily.map((d) => ({
    day: dayLabel(d.date),
    current: d.count,
    previous: null,
  }));
}

export type ConversionRow = {
  label: string;
  applications: number;
  attendees: number;
  /** Attendees per application, in percent. */
  rate: number;
};

/**
 * The Events that have begun (running or ended in the last 30 days), latest
 * first, with how many of their applicants came. Events still to come have no
 * check-ins yet and would read as zero.
 */
export function eventConversion(
  stats: readonly EventStat[],
  now = new Date(),
  limit = 8,
): ConversionRow[] {
  return stats
    .filter((s) => s.applications > 0 && s.startDate && Date.parse(s.startDate) <= now.getTime())
    .sort((a, b) => Date.parse(b.startDate ?? '') - Date.parse(a.startDate ?? ''))
    .slice(0, limit)
    .map((s) => {
      const rate = Math.round((s.checkedIn / s.applications) * 100);
      return {
        label: `${s.name} · %${rate}`,
        applications: s.applications,
        attendees: s.checkedIn,
        rate,
      };
    });
}

export type TeamRow = { label: string; applications: number; attendees: number };

/** Applications and attendance by Owner team over 12 months, when more than one team is in scope. */
export function teamRows(home: DashboardHome | undefined): TeamRow[] {
  const teams = home?.teams ?? [];
  if (teams.length < 2) return [];
  return teams.slice(0, 8).map((t) => ({
    label: `${t.team || 'Kulüp'} · ${t.events} etk.`,
    applications: t.applications,
    attendees: t.attendees,
  }));
}

/** Published Events by Owner team over 12 months: the club's view, for everyone. */
export function clubTeamRows(
  home: DashboardHome | undefined,
): Array<{ label: string; count: number }> {
  return (home?.club.eventsByTeam ?? [])
    .slice(0, 8)
    .map((t) => ({ label: t.team || 'Kulüp', count: t.count }));
}
