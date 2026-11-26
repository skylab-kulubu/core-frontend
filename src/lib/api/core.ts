import { accessToken, forgetAccessToken, isKeptAccessToken } from '@/lib/auth/access-token';
import { clearCoreReads, keptRead, type CoreAnswer } from './core-read-cache';

export const CORE_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

/** What a problem+json answer says beyond its status and title. */
export type ProblemDetails = {
  /** Core's stable, snake_case problem code, such as `media_too_large`. */
  code?: string;
  detail?: string;
  /** The problem's extension fields, such as `maxBytes` or `retryAfterSeconds`. */
  fields?: Record<string, unknown>;
};

const STANDARD_PROBLEM_FIELDS = new Set(['type', 'title', 'status', 'detail', 'instance', 'code']);

export class ProblemError extends Error {
  status: number;
  title: string;
  code?: string;
  detail?: string;
  fields: Record<string, unknown>;

  constructor(status: number, title: string, details: ProblemDetails = {}) {
    super(title);
    this.status = status;
    this.title = title;
    this.code = details.code;
    this.detail = details.detail;
    this.fields = details.fields ?? {};
  }
}

/**
 * The error for a failed response whose body is `text`: a problem+json body
 * gives its title (or, without one, its detail), code, detail and extension
 * fields; any other body gives `HTTP <status>`.
 */
export function problemFromResponse(status: number, text: string): ProblemError {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {}
  const code = typeof body.code === 'string' ? body.code : undefined;
  const detail = typeof body.detail === 'string' ? body.detail : undefined;
  const title = (typeof body.title === 'string' && body.title) || detail || `HTTP ${status}`;
  const fields: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(body)) {
    if (!STANDARD_PROBLEM_FIELDS.has(name)) fields[name] = value;
  }
  return new ProblemError(status, title, { code, detail, fields });
}

/** The session's access token for core, Forms and the CMS (kept in memory, access-token.ts). */
export async function bearer(): Promise<string | null> {
  return accessToken();
}

/**
 * Sends a request with the session's token. A 401 for a token the page kept (core may have ended
 * the session or the token may have been replaced) drops it and tries once more with a new read;
 * core refuses a request without a valid token before doing anything, so the retry repeats nothing.
 * A 401 that names a problem `code` is core's answer about the request itself (an invalid door QR,
 * `ticket_qr_invalid`), not about the token: it is not retried.
 */
export async function fetchWithToken(
  url: string,
  init: RequestInit,
  headersFor: (token: string | null) => Record<string, string>,
): Promise<Response> {
  const token = await bearer();
  const res = await fetch(url, { ...init, headers: headersFor(token) });
  if (res.status !== 401 || !isKeptAccessToken(token)) return res;
  if (problemFromResponse(401, await res.clone().text()).code) return res;
  forgetAccessToken(token);
  const again = await bearer();
  if (!again || again === token) return res;
  return fetch(url, { ...init, headers: headersFor(again) });
}

/**
 * A core request: JSON in and out, problem+json errors as ProblemError. A plain GET shares a
 * running or recent identical read (core-read-cache.ts); any other method drops those once it
 * ends. `cache: 'no-store'` always reads core.
 */
export async function coreFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const send = async (): Promise<CoreAnswer> => {
    const res = await fetchWithToken(
      `${CORE_API_URL}${path}`,
      { ...init, credentials: 'include' },
      (token) => {
        const headers: Record<string, string> = {};
        if (typeof init.body === 'string') {
          headers['Content-Type'] = 'application/json';
        }
        if (token) headers.Authorization = `Bearer ${token}`;
        if (init.headers) {
          Object.assign(headers, init.headers as Record<string, string>);
        }
        return headers;
      },
    );
    return { status: res.status, text: res.status === 204 ? '' : await res.text() };
  };
  let answer: CoreAnswer;
  if (method === 'GET' || method === 'HEAD') {
    const shared = method === 'GET' && !init.signal && !init.headers && init.cache !== 'no-store';
    answer = shared ? await keptRead(path, send) : await send();
  } else {
    try {
      answer = await send();
    } finally {
      clearCoreReads();
    }
  }
  if (answer.status === 204) {
    return undefined as T;
  }
  if (answer.status < 200 || answer.status >= 300) {
    throw problemFromResponse(answer.status, answer.text);
  }
  if (!answer.text) return undefined as T;
  return JSON.parse(answer.text) as T;
}

export async function coreFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const res = await fetchWithToken(
    `${CORE_API_URL}${path}`,
    { ...init, credentials: 'include' },
    (token) => ({
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    }),
  );
  if (!res.ok) {
    throw problemFromResponse(res.status, await res.text());
  }
  return res.blob();
}

/**
 * A core request whose answer is a file: JSON in, the Response out (its body unread), problem+json
 * errors as ProblemError.
 */
export async function coreFetchResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetchWithToken(
    `${CORE_API_URL}${path}`,
    { ...init, credentials: 'include' },
    (token) => ({
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    }),
  );
  if (!res.ok) {
    throw problemFromResponse(res.status, await res.text());
  }
  return res;
}

export async function downloadBlob(path: string, fileName: string): Promise<void> {
  const blob = await coreFetchBlob(path);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
