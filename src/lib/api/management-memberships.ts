import { coreFetch } from './core';

/** What a term's Group is (core's `role`): YK, DK, another Privileged root, or a Team's Leaders. */
export type ManagementRole = 'board' | 'audit' | 'privileged' | 'team-leaders';

/** `expiring`: within 14 days of its end; `expired`: past it, the holder still in the Group. */
export type ManagementTermStatus = 'active' | 'expiring' | 'expired';

/**
 * An open management membership term (GET /v1/management-memberships; core
 * docs/management-membership-terms.md). The names are empty for someone
 * erased or being erased; `endsAt` is null for an undated term.
 */
export type ManagementTerm = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  groupId: string;
  groupPath: string;
  role: ManagementRole;
  status: ManagementTermStatus;
  endsAt: string | null;
  seasonId: string | null;
  source: string;
  startedAt: string;
  grantedBy: string | null;
  warned14dAt: string | null;
  warned1dAt: string | null;
  expiredAt: string | null;
};

/** `immediate` takes the holder out at once; `at_term_end` leaves them in until their end is marked. */
export type HandoverMode = 'immediate' | 'at_term_end';

export type HandoverBody = {
  userId: string;
  mode: HandoverMode;
  /** A day (YYYY-MM-DD); left out, the active season's end. */
  endsAt?: string;
  /** The reader confirmed core's not_ytu_verified warning, as on the member add. */
  unverifiedAck?: boolean;
};

const BASE = '/v1/management-memberships';

/**
 * core serves these only with MANAGEMENT_TERMS_MODE=apply (404 otherwise).
 * A Group reader (Privileged, DK) lists every term; anyone else the terms of
 * the Groups whose membership they may change.
 */
export const managementMembershipsApi = {
  list: () => coreFetch<ManagementTerm[]>(BASE),
  /** A day (YYYY-MM-DD): the term ends at its end in Istanbul. Answers the term. */
  extend: (termId: string, endsAt: string) =>
    coreFetch<ManagementTerm>(`${BASE}/${encodeURIComponent(termId)}/extend`, {
      method: 'POST',
      body: JSON.stringify({ endsAt }),
    }),
  /** Adds the successor to the term's Group and answers their term. */
  handover: (termId: string, body: HandoverBody) =>
    coreFetch<ManagementTerm>(`${BASE}/${encodeURIComponent(termId)}/handover`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Takes an expired term's holder out of its Group; a term not expired is 409 term_not_expired. */
  remove: (termId: string) =>
    coreFetch<void>(`${BASE}/${encodeURIComponent(termId)}`, { method: 'DELETE' }),
};
