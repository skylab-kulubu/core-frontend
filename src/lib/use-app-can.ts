'use client';

import { useCapabilities } from '@/lib/capabilities-context';

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
