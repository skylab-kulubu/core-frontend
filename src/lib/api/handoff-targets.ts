import { SESSION_EXPIRED_DETAIL, UNEXPECTED_DETAIL } from '@/lib/handoff/messages';
import {
  parseHandoffTarget,
  parseHandoffTargets,
  type HandoffTarget,
  type HandoffTargetInput,
} from '@/lib/handoff/targets';

/** A failed call to superadmin's handoff routes; `detail` is Turkish and safe to show. */
export class HandoffProblemError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly field?: string;

  constructor(status: number, detail: string, field?: string) {
    super(detail);
    this.name = 'HandoffProblemError';
    this.status = status;
    this.detail = detail;
    this.field = field;
  }
}

const NETWORK_DETAIL = 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.';

async function request<T>(
  path: string,
  parse: (body: unknown) => T | null,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new HandoffProblemError(0, NETWORK_DETAIL);
  }
  // Without a session cookie the proxy answers API calls with a redirect to /login.
  if (response.redirected && new URL(response.url).pathname === '/login') {
    throw new HandoffProblemError(401, SESSION_EXPIRED_DETAIL);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (response.ok) {
    const parsed = parse(body);
    if (parsed === null) throw new HandoffProblemError(502, UNEXPECTED_DETAIL);
    return parsed;
  }
  const problem = (body ?? {}) as { detail?: unknown; field?: unknown };
  throw new HandoffProblemError(
    response.status,
    typeof problem.detail === 'string' && problem.detail ? problem.detail : UNEXPECTED_DETAIL,
    typeof problem.field === 'string' && problem.field ? problem.field : undefined,
  );
}

/**
 * The browser side of the "SkyApp'ten geçiş" page. It only talks to superadmin's own route
 * handlers, which call Keycloak with the admin's token from the httpOnly session cookie.
 */
export const handoffTargetsApi = {
  list: () => request('/api/handoff-targets', parseHandoffTargets),
  update: (clientId: string, input: HandoffTargetInput) =>
    request(`/api/handoff-targets/${encodeURIComponent(clientId)}`, parseHandoffTarget, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
};
