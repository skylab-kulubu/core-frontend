import { coreFetch } from './core';
import type { RaffleVerification } from '@/lib/raffle/verify';

export type RaffleTicketType = 'REGISTERED' | 'GUEST';

/** Who may be drawn (core docs/raffle.md). Cancelled and waitlisted Tickets never are. */
export type RaffleCriteria = {
  /** At least this many counted Sessions attended; null for no such condition. */
  minCounted: number | null;
  /** These Sessions attended; empty for no such condition. */
  sessionIds: string[];
  /** All of `sessionIds`, or any one of them. */
  sessionMatch: 'all' | 'any';
  /** Entered the venue: '' no condition, 'any' on any day, or on this 'YYYY-MM-DD'. */
  enteredOn: string;
  /** '' for both. */
  ticketType: '' | RaffleTicketType;
  /** Passed the Event's certificate threshold. */
  certificateEligible: boolean;
  excludePastWinners: boolean;
  /** Members of the organising team. */
  excludeOrganizers: boolean;
  excludeDoorStaff: boolean;
  /** Members of co-organising teams and co-organising people. */
  excludeCoOrganizers: boolean;
};

export const DEFAULT_RAFFLE_CRITERIA: RaffleCriteria = {
  minCounted: null,
  sessionIds: [],
  sessionMatch: 'all',
  enteredOn: '',
  ticketType: '',
  certificateEligible: false,
  excludePastWinners: true,
  excludeOrganizers: true,
  excludeDoorStaff: true,
  excludeCoOrganizers: true,
};

export type RaffleExcluded = {
  pastWinners: number;
  organizers: number;
  doorStaff: number;
  coOrganizers: number;
};

export type RafflePreview = {
  eligible: number;
  excluded: RaffleExcluded;
  /** Names masked by core ("Ay*** Yı***"). */
  candidates: { name: string; ticketType: RaffleTicketType }[];
  /** More are eligible than `candidates` lists. */
  truncated: boolean;
};

export type RafflePerson = { id: string; name: string };

export type RaffleSummary = {
  id: string;
  title: string;
  drawnAt: string;
  drawnBy: RafflePerson | null;
  eligibleCount: number;
  winnerCount: number;
  alternateCount: number;
  criteria: RaffleCriteria;
};

export type RaffleEntryStatus = 'winner' | 'alternate' | 'forfeited';

export type RaffleEntry = {
  position: number;
  status: RaffleEntryStatus;
  ticketId: string;
  name: string;
  maskedEmail: string;
  ticketType: RaffleTicketType;
  /** An alternate who became a winner after a forfeit. */
  promotedAt: string | null;
  forfeitedAt: string | null;
  forfeitReason: string | null;
  forfeitedBy: RafflePerson | null;
};

export type Raffle = RaffleSummary & {
  eventId: string;
  listHash: string;
  seed: string;
  algorithm: string;
  /** In position order. */
  entries: RaffleEntry[];
};

export type RaffleDraw = {
  /** At most 120 characters; core writes "Çekiliş" for an empty one. */
  title: string;
  criteria: RaffleCriteria;
  /** 1..100 */
  winners: number;
  /** 0..100 */
  alternates: number;
};

export const RAFFLE_TITLE_MAX = 120;
export const RAFFLE_MAX_WINNERS = 100;
export const RAFFLE_MAX_ALTERNATES = 100;
export const FORFEIT_REASON_MIN = 3;
export const FORFEIT_REASON_MAX = 300;

const base = (eventId: string) => `/v1/events/${encodeURIComponent(eventId)}/raffles`;
const one = (eventId: string, raffleId: string) =>
  `${base(eventId)}/${encodeURIComponent(raffleId)}`;

export const rafflesApi = {
  /** Who the criteria take now; never cached, the form asks again on every change. */
  preview: (eventId: string, criteria: RaffleCriteria, signal?: AbortSignal) =>
    coreFetch<RafflePreview>(`${base(eventId)}/preview`, {
      method: 'POST',
      body: JSON.stringify({ criteria }),
      signal,
    }),
  /** Draws and records the Raffle (201). 409 `raffle_too_few_candidates`, 503 `audit_unavailable`. */
  draw: (eventId: string, body: RaffleDraw) =>
    coreFetch<Raffle>(base(eventId), { method: 'POST', body: JSON.stringify(body) }),
  /** The Event's Raffles, newest first. */
  list: (eventId: string) =>
    coreFetch<{ items: RaffleSummary[] }>(base(eventId), { cache: 'no-store' }).then(
      (answer) => answer?.items ?? [],
    ),
  get: (eventId: string, raffleId: string) =>
    coreFetch<Raffle>(one(eventId, raffleId), { cache: 'no-store' }),
  /** The winner at `position` did not come: the next alternate becomes a winner. */
  forfeit: (eventId: string, raffleId: string, position: number, reason: string) =>
    coreFetch<Raffle>(`${one(eventId, raffleId)}/forfeits`, {
      method: 'POST',
      body: JSON.stringify({ position, reason }),
    }),
  verification: (eventId: string, raffleId: string) =>
    coreFetch<RaffleVerification>(`${one(eventId, raffleId)}/verification`, {
      cache: 'no-store',
    }),
};
