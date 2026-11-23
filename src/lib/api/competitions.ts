import { coreFetch } from './core';

/** core-backend docs/competitions.md (ADR-0068): a Competition of one Event, scored from a ledger. */
export type CompetitionStatus = 'draft' | 'open' | 'running' | 'closed' | 'cancelled';

export type Competition = {
  id: string;
  eventId: string;
  ownerTeam: string;
  name: string;
  description: string;
  entrantMode: string;
  status: CompetitionStatus;
  cancelReason?: string;
  stages: Array<{ id: string; position: number; strategy: string }>;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompetitionMember = { ticketId: string; ticketType: string; displayName: string };

export type Entrant = {
  id: string;
  competitionId: string;
  status: string;
  displayName: string;
  members: CompetitionMember[];
  createdAt: string;
};

/** A ledger row: a score as written, revoked rows kept. */
export type CompetitionEntry = {
  id: string;
  entrantId: string;
  points: number | null;
  recordedAt: string;
  replacesId?: string;
  revokedAt?: string;
  revokeReason?: string;
};

export type LeaderboardRow = {
  /** Null for an Entrant without a score, listed after the ranked ones. */
  rank: number | null;
  entrantId: string;
  displayName: string;
  score: number | null;
  /** The live score's Entry: what a correction replaces. */
  entryId: string | null;
};

export type Leaderboard = {
  competitionId: string;
  stageId: string;
  strategy: string;
  rows: LeaderboardRow[];
};

export type EntrantCandidate = {
  ticketId: string;
  displayName: string;
  ticketType: string;
  checkedIn: boolean;
  /** Already an Entrant of this Competition. */
  entrant: boolean;
};

const competition = (id: string) => `/v1/competitions/${encodeURIComponent(id)}`;

export type CompetitionMove = 'open' | 'start' | 'close' | 'reopen';

export const competitionsApi = {
  listByEvent: (eventId: string) =>
    coreFetch<Competition[]>(`/v1/events/${encodeURIComponent(eventId)}/competitions`),
  create: (eventId: string, body: { name: string; description?: string }) =>
    coreFetch<Competition>(`/v1/events/${encodeURIComponent(eventId)}/competitions`, {
      method: 'POST',
      body: JSON.stringify({ ...body, entrantMode: 'individual' }),
    }),
  update: (id: string, body: { name?: string; description?: string }) =>
    coreFetch<Competition>(competition(id), { method: 'PATCH', body: JSON.stringify(body) }),
  move: (id: string, to: CompetitionMove) =>
    coreFetch<Competition>(`${competition(id)}/${to}`, { method: 'POST' }),
  cancel: (id: string, reason: string) =>
    coreFetch<Competition>(`${competition(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  entrants: (id: string) => coreFetch<Entrant[]>(`${competition(id)}/entrants`),
  candidates: (id: string, query = '') => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim().slice(0, 100));
    const q = params.toString();
    return coreFetch<EntrantCandidate[]>(
      `${competition(id)}/entrant-candidates${q ? `?${q}` : ''}`,
    );
  },
  addEntrants: (id: string, ticketIds: string[]) =>
    coreFetch<Entrant[]>(`${competition(id)}/entrants`, {
      method: 'POST',
      body: JSON.stringify({ ticketIds }),
    }),
  /**
   * A score: the first one without `replacesId`; a correction names the live Entry it replaces
   * and says why. 409 `score_changed` carries the live Entry another organizer wrote meanwhile.
   */
  score: (
    id: string,
    body: { entrantId: string; points: number; replacesId?: string; reason?: string },
  ) =>
    coreFetch<CompetitionEntry>(`${competition(id)}/scores`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revoke: (id: string, entryId: string, reason: string) =>
    coreFetch<CompetitionEntry>(
      `${competition(id)}/entries/${encodeURIComponent(entryId)}/revoke`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  entries: (id: string) => coreFetch<CompetitionEntry[]>(`${competition(id)}/entries`),
  leaderboard: (id: string) => coreFetch<Leaderboard>(`${competition(id)}/leaderboard`),
};

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  draft: 'Taslak',
  open: 'Katılıma açık',
  running: 'Sürüyor',
  closed: 'Kapandı',
  cancelled: 'İptal',
};

/** The next steps a status offers (docs/competitions.md "Status"), in the order shown. */
export function competitionMoves(status: CompetitionStatus): CompetitionMove[] {
  switch (status) {
    case 'draft':
      return ['open', 'start'];
    case 'open':
      return ['start', 'close'];
    case 'running':
      return ['close'];
    case 'closed':
      return ['reopen'];
    default:
      return [];
  }
}

export const MOVE_LABELS: Record<CompetitionMove, string> = {
  open: 'Katılıma aç',
  start: 'Başlat',
  close: 'Kapat',
  reopen: 'Yeniden aç',
};

/** Points as core takes them: a number with at most three decimals; null for anything else. */
export function parsePoints(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^-?\d{1,10}(\.\d{1,3})?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && Math.abs(value) <= 1_000_000_000 ? value : null;
}

/** Whether Entrants may still join: not once closed or cancelled. */
export const takesEntrants = (status: CompetitionStatus) =>
  status === 'draft' || status === 'open' || status === 'running';
