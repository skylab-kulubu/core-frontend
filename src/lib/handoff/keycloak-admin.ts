import { NextResponse } from 'next/server';
import {
  FORBIDDEN_DETAIL,
  HANDOFF_API_MISSING_DETAIL,
  KEYCLOAK_DOWN_DETAIL,
  KEYCLOAK_REFUSED_DETAIL,
  SESSION_EXPIRED_DETAIL,
} from '@/lib/handoff/messages';
import { asProblem, problemResponse, relayProblem } from '@/lib/handoff/problem';

/** `sky-handoff` lives in the same realm superadmin signs in with, so its issuer is the base. */
function handoffAdminUrl(path: string): string | null {
  const issuer = (process.env.OAUTH2_ISSUER || '').replace(/\/+$/, '');
  return issuer ? `${issuer}/sky-handoff/v1/admin${path}` : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}

/**
 * Calls the sky-handoff admin API as the signed-in admin and turns the answer into the
 * route handler's response: 2xx JSON as is, 4xx problems with their Turkish `detail`, and
 * anything else as a 502 problem so the browser never sees Keycloak internals.
 */
export async function callHandoffAdmin(
  token: string,
  path: string,
  init: { method?: 'GET' | 'PUT'; body?: unknown } = {},
): Promise<NextResponse> {
  const url = handoffAdminUrl(path);
  if (!url) {
    return problemResponse(503, 'Keycloak adresi (OAUTH2_ISSUER) tanımlı değil.');
  }
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch {
    return problemResponse(502, KEYCLOAK_DOWN_DETAIL);
  }

  const body = await readJson(upstream);
  if (upstream.ok && body !== undefined) {
    return NextResponse.json(body, { status: upstream.status });
  }
  const status = upstream.status;
  if (status < 400 || status >= 500) return problemResponse(502, KEYCLOAK_DOWN_DETAIL);
  if (status === 401) return problemResponse(401, SESSION_EXPIRED_DETAIL);
  const problem = asProblem(body, status);
  if (problem) return relayProblem(problem);
  // Answers without a problem body come from Keycloak itself, not from sky-handoff.
  if (status === 403) return problemResponse(403, FORBIDDEN_DETAIL);
  if (status === 404) return problemResponse(502, HANDOFF_API_MISSING_DETAIL);
  return problemResponse(status, KEYCLOAK_REFUSED_DETAIL);
}
