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

async function bearer(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const res = await fetch('/api/auth/token', { credentials: 'include' });
  if (!res.ok) return null;
  const body = (await res.json()) as { token?: string };
  return body.token ?? null;
}

export async function coreFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await bearer();
  const headers: Record<string, string> = {};
  if (typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }
  const res = await fetch(`${CORE_API_URL}${path}`, { ...init, credentials: 'include', headers });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!res.ok) {
    throw problemFromResponse(res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function coreFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const token = await bearer();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${CORE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    throw problemFromResponse(res.status, await res.text());
  }
  return res.blob();
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
