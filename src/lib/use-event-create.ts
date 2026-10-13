'use client';

import { canWriteEvent, isPrivileged, leaderOwnerTeams } from '@/lib/auth/groups';
import { useCapabilities } from '@/lib/capabilities-context';
import { useTeamCan } from '@/lib/use-app-can';

/**
 * Who may create an Event: the group rule (a Privileged member for any team,
 * a Leader for their own) narrowed by core's `event.create`. A DK member is
 * Privileged but writes nothing; a DK member who leads a team creates for that
 * team only, as a Leader. `privilegedWriter` is a Privileged member core lets
 * create for any team (owner optional, every team, seasons); `ready` is
 * whether core's answer is in (or could not be read, so the group rule stands).
 */
export function useEventCreate(groups: readonly string[]): {
  canCreate: boolean;
  privilegedWriter: boolean;
  leaderTeams: string[];
  ready: boolean;
} {
  const teamCan = useTeamCan();
  const ready = useCapabilities().status !== 'loading';
  const leaderTeams = leaderOwnerTeams(groups);
  const privilegedWriter = isPrivileged(groups) && teamCan('', 'event.create');
  const canCreate =
    privilegedWriter ||
    leaderTeams.some(
      (team) => canWriteEvent(groups, team, 'create') && teamCan(team, 'event.create'),
    );
  return { canCreate, privilegedWriter, leaderTeams, ready };
}
