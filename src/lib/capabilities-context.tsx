'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { capabilitiesApi, type Capabilities } from '@/lib/api/capabilities';
import { useRefreshOnReturn } from '@/lib/use-refresh-on-return';

/** core's "yeteneklerim" answer as a page sees it: still coming, read, or unreadable. */
export type CapabilitiesState =
  | { status: 'loading' }
  | { status: 'ready'; data: Capabilities }
  | { status: 'failed' };

const CapabilitiesContext = createContext<CapabilitiesState | null>(null);

/**
 * Reads GET /v1/users/me/capabilities once per person while `enabled`; with
 * `live`, again when the person comes back to the tab and when their token is
 * renewed (useRefreshOnReturn), so a group joined while the panel was open
 * shows without signing in again. Those reads keep the answer on screen
 * meanwhile, and a read that fails keeps it too: "failed" opens every gate.
 */
function useCapabilitiesRead(
  enabled: boolean,
  userId: string | undefined,
  live = false,
): CapabilitiesState {
  const [state, setState] = useState<CapabilitiesState>({ status: 'loading' });
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: 'loading' });
    capabilitiesApi
      .get()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data: data ?? {} });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || round === 0) return;
    let cancelled = false;
    capabilitiesApi
      .get()
      .then((data) => {
        if (cancelled) return;
        const next = data ?? {};
        setState((shown) =>
          shown.status === 'ready' && JSON.stringify(shown.data) === JSON.stringify(next)
            ? shown
            : { status: 'ready', data: next },
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, round]);

  useRefreshOnReturn(() => setRound((n) => n + 1), enabled && live);

  return state;
}

/**
 * Reads the capabilities for the signed-in chrome, so the navigation and
 * every page share one request; read again on return and on token renewal.
 */
export function CapabilitiesProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const state = useCapabilitiesRead(true, userId, true);
  return <CapabilitiesContext.Provider value={state}>{children}</CapabilitiesContext.Provider>;
}

/** The shared answer inside CapabilitiesProvider; outside one (a lone page) its own read. */
export function useCapabilities(): CapabilitiesState {
  const shared = useContext(CapabilitiesContext);
  const own = useCapabilitiesRead(shared === null, undefined);
  return shared ?? own;
}
