'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { capabilitiesApi, type Capabilities } from '@/lib/api/capabilities';

/** core's "yeteneklerim" answer as a page sees it: still coming, read, or unreadable. */
export type CapabilitiesState =
  | { status: 'loading' }
  | { status: 'ready'; data: Capabilities }
  | { status: 'failed' };

const CapabilitiesContext = createContext<CapabilitiesState | null>(null);

/** Reads GET /v1/users/me/capabilities once per person while `enabled`. */
function useCapabilitiesRead(enabled: boolean, userId: string | undefined): CapabilitiesState {
  const [state, setState] = useState<CapabilitiesState>({ status: 'loading' });

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

  return state;
}

/**
 * Reads the capabilities once for the signed-in chrome, so the navigation and
 * every page share one request.
 */
export function CapabilitiesProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const state = useCapabilitiesRead(true, userId);
  return <CapabilitiesContext.Provider value={state}>{children}</CapabilitiesContext.Provider>;
}

/** The shared answer inside CapabilitiesProvider; outside one (a lone page) its own read. */
export function useCapabilities(): CapabilitiesState {
  const shared = useContext(CapabilitiesContext);
  const own = useCapabilitiesRead(shared === null, undefined);
  return shared ?? own;
}
