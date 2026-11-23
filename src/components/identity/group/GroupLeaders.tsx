'use client';

import { EmptyState } from '@/components/chrome/PageState';
import { useGroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import { SubTeams } from '@/components/identity/SubTeams';
import { TeamLeaders } from '@/components/identity/TeamLeaders';
import { managedParentOf } from '@/lib/sub-teams';

/**
 * Liderler ve alt ekipler (Entra's Owners, with a Team's Sub-teams): the Team's
 * Leaders and Coordinators and the Teams below it, with what core lets the
 * reader do on each (core's managed tree).
 */
export function GroupLeaders() {
  const { base, managed, managedGroups, canReadUsers, reload } = useGroupWorkspace();
  if (!managed) {
    return <EmptyState kind="first-use" title="Bu grubun lideri ve alt ekibi yok" />;
  }
  const tree = managedGroups.status === 'ready' ? managedGroups.groups : [];
  return (
    <div className="flex flex-col gap-6">
      <TeamLeaders
        team={managed}
        // A Team the tree starts at: for Privileged, who alone names its Leaders, a top Team
        top={managedGroups.status === 'ready' && !managedParentOf(tree, managed.id)}
        personHref={canReadUsers ? (userId) => `/users/${encodeURIComponent(userId)}` : undefined}
        onChanged={() => {
          managedGroups.reload();
          void reload();
        }}
      />
      <SubTeams team={managed} tree={tree} base={base} onChanged={managedGroups.reload} />
    </div>
  );
}
