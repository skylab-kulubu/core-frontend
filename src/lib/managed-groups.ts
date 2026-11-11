'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { identityApi, type ManagedGroup } from '@/lib/api/identity';
import { useCapabilities } from '@/lib/capabilities-context';

/** A managed Team and how deep it sits under the Team the reader leads (0 for that one). */
export type ManagedGroupRow = { group: ManagedGroup; depth: number };

/** The managed tree as rows, each Team followed by the Teams below it. */
export function flattenManagedGroups(nodes: readonly ManagedGroup[], depth = 0): ManagedGroupRow[] {
  return nodes.flatMap((group) => [
    { group, depth },
    ...flattenManagedGroups(group.children ?? [], depth + 1),
  ]);
}

/** The managed Team with this Keycloak id, anywhere in the tree. */
export function findManagedGroup(
  nodes: readonly ManagedGroup[],
  id: string,
): ManagedGroup | undefined {
  return flattenManagedGroups(nodes).find((row) => row.group.id === id)?.group;
}

export type ManagedGroupsState =
  | { status: 'loading' }
  | { status: 'ready'; groups: ManagedGroup[] }
  | { status: 'failed' };

/**
 * The Teams the reader manages (core's managed tree), read only when core's
 * capabilities name a managed Team (team delegation on, the reader a Leader);
 * otherwise none. A failed capabilities read tries the tree too: core answers
 * `[]` to someone who leads nothing.
 *
 * `privileged` reads it for a Privileged reader too (core's `group.read`):
 * core answers them every Team, with their decisions on each, whether team
 * delegation is on or off. `reload` reads it again after a change, keeping
 * the tree on screen meanwhile.
 */
export function useManagedGroups({ privileged = false }: { privileged?: boolean } = {}) {
  const capabilities = useCapabilities();
  const leads =
    privileged ||
    capabilities.status === 'failed' ||
    (capabilities.status === 'ready' && (capabilities.data.managedTeams?.length ?? 0) > 0);
  const [state, setState] = useState<ManagedGroupsState>({ status: 'loading' });
  const [round, setRound] = useState(0);
  const shownRound = useRef(round);

  useEffect(() => {
    if (capabilities.status === 'loading') return;
    if (!leads) {
      setState({ status: 'ready', groups: [] });
      return;
    }
    // A first read, or one for a reader who now reads more, shows as loading; a reload keeps the tree
    if (shownRound.current === round) setState({ status: 'loading' });
    shownRound.current = round;
    let cancelled = false;
    identityApi
      .managedGroups()
      .then((groups) => {
        if (!cancelled) setState({ status: 'ready', groups: groups ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [capabilities.status, leads, round]);

  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { ...state, reload } as ManagedGroupsState & { reload: () => void };
}
