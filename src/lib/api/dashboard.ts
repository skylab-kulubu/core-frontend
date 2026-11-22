import type { ProfilePicture } from '@/lib/profile-picture';
import { coreFetch } from './core';

/** A day ('YYYY-MM-DD') or month ('YYYY-MM') counted in Europe/Istanbul. */
export type DayCount = { date: string; count: number };
export type MonthCount = { month: string; count: number };

/** One running, coming or recently ended Event the caller may read the applicants of. */
export type EventStat = {
  id: string;
  name: string;
  ownerTeam: string;
  location: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  /** The stored status (ADR 0066). */
  status?: 'draft' | 'published' | 'cancelled';
  live: boolean;
  capacity: number;
  coverImageUrl?: string;
  hasApplicationForm: boolean;
  hasCoverImage: boolean;
  applications: number;
  members: number;
  guests: number;
  checkedIn: number;
  /** The last 14 days, oldest first, today last. */
  dailyApplications: number[];
};

export type RecentJoiner = ProfilePicture & {
  id: string;
  firstName: string;
  lastName: string;
  teams: string[];
  registeredAt: string;
};

/**
 * The dashboard in one answer (core-backend docs/dashboard-summary.md), scoped
 * by core to the Owner teams whose applicants the caller may read; `members`
 * only for those who may read people. No contact details, no single Ticket.
 */
export type DashboardSummary = {
  generatedAt: string;
  timeZone: 'Europe/Istanbul';
  ownerTeams: string[];
  events: { total: number; upcoming: number; live: number; byMonth: MonthCount[] };
  applications: {
    total: number;
    members: number;
    guests: number;
    checkedIn: number;
    /** The last 30 days, oldest first, today last. */
    daily: DayCount[];
  };
  /** Running, coming and ended within 30 days, by start date. */
  eventStats: EventStat[];
  members: null | {
    active: number;
    /** 12 months, oldest first. */
    newByMonth: MonthCount[];
    recentJoiners: RecentJoiner[];
    asOf: string;
  };
  /** The caller may see members, but Keycloak could not be read. */
  membersUnavailable?: boolean;
  /** The home page; missing from an older core, which the page falls back from. */
  home?: DashboardHome;
};

export type TodoEvent = { id: string; name: string; ownerTeam: string; startDate?: string };

/** What an Event that starts soon still lacks. */
export type MissingPart = 'location' | 'form' | 'sessions';

export type DashboardTodo = {
  /** Drafts the caller may publish, by start date, undated last. */
  drafts: TodoEvent[];
  /** Published Events running now or starting today or tomorrow that lack something. */
  incomplete: Array<TodoEvent & { live: boolean; missing: MissingPart[] }>;
  failedCertificates: Array<{ eventId: string; eventName: string; failed: number }>;
  /** Only for who handles data subject requests. */
  subjectRequests: { open: number; overdue: number } | null;
};

export type WeekEvent = {
  id: string;
  name: string;
  ownerTeam: string;
  location: string;
  startDate?: string;
  endDate?: string;
  live: boolean;
};

export type WeekSession = {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  startTime: string;
  endTime?: string;
};

export type Period = { current: number; previous: number };

/**
 * The home page (core-backend docs/dashboard-summary.md, Home): what waits on
 * the caller, the week from today, and the last 30 days against the 30 before.
 */
export type DashboardHome = {
  /** Null for a caller who can act on none of it. */
  todo: DashboardTodo | null;
  week: { from: string; to: string; events: WeekEvent[]; sessions: WeekSession[] };
  /** Null for a caller with no Event and no people in scope. */
  compare: {
    days: number;
    applications: Period;
    attendees: Period;
    events: Period;
    newMembers: Period | null;
  } | null;
  /** 60 days, oldest first: the last 30 and the 30 before. Empty without covered Events. */
  daily: Array<{ date: string; applications: number; attendees: number }>;
  /** 12 months, oldest first. Attendees are summed over days (a Ticket counts once a day). */
  monthly: Array<{ month: string; applications: number; attendees: number; events: number }>;
  /** Owner teams over the 12 months, most applications first; team '' is the club itself. */
  teams: Array<{ team: string; events: number; applications: number; attendees: number }>;
  sessions: number;
  certificates: { issued: number; revoked: number; period: Period } | null;
  season: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    events: Array<{ id: string; name: string; ownerTeam: string; startDate: string }>;
  } | null;
  /** Published Events, whoever owns them: what every signed-in person may see. */
  club: {
    eventsByMonth: MonthCount[];
    eventsByTeam: Array<{ team: string; count: number }>;
  };
};

export const dashboardApi = {
  summary: () => coreFetch<DashboardSummary>('/v1/dashboard/summary'),
};
