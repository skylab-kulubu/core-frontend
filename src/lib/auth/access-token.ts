import { noteAccessToken } from '@/lib/auth/session-renewal';

/**
 * The session's access token in the page, read through this app's token route and kept in memory
 * until shortly before it expires. Before this every core, Forms and CMS request first asked the
 * route, one extra round per request. Concurrent callers share one read, so a page that starts
 * twenty requests asks once.
 *
 * Memory only: never localStorage or sessionStorage (ADR-0058; the token leaves the browser
 * entirely once the panel's server forwards the API calls).
 */

/**
 * Seconds before the server's expiry at which the page stops using a token and asks again. Below
 * the route's own 15 s leeway (jwt-expiry.ts), so the route then answers with a refreshed token
 * instead of the same one.
 */
export const ACCESS_TOKEN_MARGIN_SECONDS = 10;

type Kept = { token: string; until: number };

let kept: Kept | null = null;
let pending: { generation: number; read: Promise<string | null> } | null = null;
// Bumped whenever the kept token is dropped: a read that started before then does not refill it
let generation = 0;

async function readToken(): Promise<string | null> {
  const started = generation;
  const res = await fetch('/api/auth/token', { credentials: 'include' });
  if (!res.ok) return null;
  const body = (await res.json()) as { token?: string | null; expiresIn?: number | null };
  const token = body.token ?? null;
  const expiresIn = typeof body.expiresIn === 'number' ? body.expiresIn : 0;
  if (token && started === generation && expiresIn > ACCESS_TOKEN_MARGIN_SECONDS) {
    kept = { token, until: Date.now() + (expiresIn - ACCESS_TOKEN_MARGIN_SECONDS) * 1000 };
  }
  noteAccessToken(token);
  return token;
}

/** The access token for an API call; `null` without a session (or on the server). */
export async function accessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (kept && Date.now() < kept.until) return kept.token;
  kept = null;
  if (pending && pending.generation === generation) return pending.read;
  const read = readToken().finally(() => {
    if (pending?.read === read) pending = null;
  });
  pending = { generation, read };
  return read;
}

/** Whether `token` is the one kept in memory (a 401 for it may be retried with a new read). */
export function isKeptAccessToken(token: string | null): boolean {
  return token !== null && kept?.token === token;
}

/**
 * Drops the kept token (an API refused it), or any token when none is named; the next call reads
 * the route again.
 */
export function forgetAccessToken(token?: string | null): void {
  if (token !== undefined && kept?.token !== token) return;
  kept = null;
  generation += 1;
}
