export const CORE_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

export class ProblemError extends Error {
  status: number;
  title: string;

  constructor(status: number, title: string) {
    super(title);
    this.status = status;
    this.title = title;
  }
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
    let title = `HTTP ${res.status}`;
    try {
      const body = JSON.parse(text) as { title?: string };
      if (body.title) title = body.title;
    } catch {}
    throw new ProblemError(res.status, title);
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
    let title = `HTTP ${res.status}`;
    try {
      const body = JSON.parse(await res.text()) as { title?: string };
      if (body.title) title = body.title;
    } catch {}
    throw new ProblemError(res.status, title);
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
