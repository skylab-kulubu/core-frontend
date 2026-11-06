'use client';

import { useMemo } from 'react';
import { canWriteEvent, isPrivileged } from '@/lib/auth/groups';
import { useCapabilities } from '@/lib/capabilities-context';
import { leaderTeamsOf, teamDecision } from '@/lib/use-app-can';

/**
 * Who may create an Event: core's `event.create` for the team, the group rule
 * (a Privileged member for any team, a Leader for their own) standing in only
 * when core's answer cannot be read. A DK member is Privileged but writes
 * nothing; a DK member who leads a team creates for that team only, as a
 * Leader; a Leader of a Team above creates for its Sub-teams too (core lists
 * them as LEADER). `privilegedWriter` is a Privileged member core lets create
 * for any team (owner optional, every team, seasons); `ready` is whether core's
 * answer is in (or could not be read, so the group rule stands).
 */
export function useEventCreate(groups: readonly string[]): {
  canCreate: boolean;
  privilegedWriter: boolean;
  leaderTeams: string[];
  ready: boolean;
} {
  const state = useCapabilities();
  const ready = state.status !== 'loading';
  // One array while the names stay the same: pages read it in their effects
  const names = leaderTeamsOf(state, groups).join('\n');
  const leaderTeams = useMemo(() => (names ? names.split('\n') : []), [names]);
  const privilegedWriter = isPrivileged(groups) && teamDecision(state, '', 'event.create', true);
  const canCreate =
    privilegedWriter ||
    leaderTeams.some((team) =>
      teamDecision(state, team, 'event.create', canWriteEvent(groups, team, 'create')),
    );
  return { canCreate, privilegedWriter, leaderTeams, ready };
}
