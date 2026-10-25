'use client';

import { leaderOwnerTeams } from '@/lib/auth/groups';
import { useCapabilities, type CapabilitiesState } from '@/lib/capabilities-context';

/**
 * core's answer to "may I" for a decision that names no Owner team
 * (GET /v1/users/me/capabilities `can`), so a page shows only the buttons
 * whose requests core would take: a DK member reads and sees no write button.
 * Until the answer arrives every key is `false`; when it cannot be read,
 * `fallback` (the page's group rule) stands in, since core still decides
 * every request.
 */
export function useAppCan(fallback: boolean): (key: string) => boolean {
  const state = useCapabilities();
  return (key) => {
    if (state.status === 'failed') return fallback;
    return state.status === 'ready' && Boolean(state.data.can?.[key]);
  };
}

/**
 * useAppCan for a key an older core does not send yet: while a read answer
 * lacks `key`, `olderKey` stands in (`url.moderateWrite` came after
 * `url.moderate`), so the panel can ship before core.
 */
export function useAppCanSince(fallback: boolean): (key: string, olderKey: string) => boolean {
  const state = useCapabilities();
  return (key, olderKey) => {
    if (state.status === 'failed') return fallback;
    if (state.status !== 'ready') return false;
    const can = state.data.can ?? {};
    return Boolean(key in can ? can[key] : can[olderKey]);
  };
}

/**
 * core's answer for a record of an Owner team (`teams`, `otherTeams`,
 * `noOwnerTeam` scopes; `''` is no Owner team). Pages AND it with their own
 * group rule: until the answer arrives it is `false`; when it cannot be read
 * it is `true`, so the group rule alone stands.
 */
export function useTeamCan(): (ownerTeam: string, key: string) => boolean {
  const state = useCapabilities();
  return (ownerTeam, key) => {
    if (state.status === 'failed') return true;
    if (state.status !== 'ready') return false;
    const { teams, otherTeams, noOwnerTeam } = state.data;
    const scope = !ownerTeam
      ? noOwnerTeam
      : (teams?.find((row) => row.team === ownerTeam) ?? otherTeams);
    return Boolean(scope?.can?.[key]);
  };
}

/**
 * Whether core allows `key` for a record of any team scope (no Owner team,
 * a team the caller is in, or another): for a page that writes before it
 * knows the Owner team, such as a new certificate template. The same
 * loading/failed rule as useTeamCan.
 */
export function useAnyTeamCan(): (key: string) => boolean {
  const state = useCapabilities();
  return (key) => {
    if (state.status === 'failed') return true;
    if (state.status !== 'ready') return false;
    const { teams, otherTeams, noOwnerTeam } = state.data;
    return [noOwnerTeam, otherTeams, ...(teams ?? [])].some((scope) => Boolean(scope?.can?.[key]));
  };
}

/** A decision for a record of an Owner team: core's, or the page's group rule standing in. */
export type TeamDecide = (ownerTeam: string, key: string, groupRule: boolean) => boolean;

/**
 * core's decision for a record of Owner team `ownerTeam` (`teams`, `otherTeams`,
 * `noOwnerTeam`), which the page's group rule cannot know in full: a Leader of
 * a Team above leads its Sub-teams' Events too (ADR 0065 decision 2, core
 * ekip-yetkileri ticket 12; core lists those Sub-teams in `teams`). Until the
 * answer arrives it is `false`; when it cannot be read, `groupRule` stands in.
 */
export function teamDecision(
  state: CapabilitiesState,
  ownerTeam: string,
  key: string,
  groupRule: boolean,
): boolean {
  if (state.status === 'failed') return groupRule;
  if (state.status !== 'ready') return false;
  const { teams, otherTeams, noOwnerTeam } = state.data;
  const scope = !ownerTeam
    ? noOwnerTeam
    : (teams?.find((row) => row.team === ownerTeam) ?? otherTeams);
  return Boolean(scope?.can?.[key]);
}

/** teamDecision over the shared capabilities. */
export function useTeamDecide(): TeamDecide {
  const state = useCapabilities();
  return (ownerTeam, key, groupRule) => teamDecision(state, ownerTeam, key, groupRule);
}

/**
 * The Owner teams the caller leads, by name: core's `teams` with `LEADER`
 * once its answer is in (a Sub-team led from above included; a path the group
 * rule misreads, such as `/X/LIDERLER/ALT`, left out), the group rule's until
 * then or when it cannot be read. Each write still asks teamDecision.
 */
export function leaderTeamsOf(state: CapabilitiesState, groups: readonly string[]): string[] {
  if (state.status !== 'ready') return leaderOwnerTeams(groups);
  return (state.data.teams ?? [])
    .filter((row) => row.levels?.includes('LEADER'))
    .map((row) => row.team);
}
