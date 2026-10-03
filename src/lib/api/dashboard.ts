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

export type RecentJoiner = {
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
};

export const dashboardApi = {
  summary: () => coreFetch<DashboardSummary>('/v1/dashboard/summary'),
};
