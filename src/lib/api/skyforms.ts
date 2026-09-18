import { CORE_API_URL, ProblemError } from '@/lib/api/core';

export const FORM_STATUS_CLOSED = 1;
export const FORM_STATUS_OPEN = 2;

export type FormGate = 'open' | 'closed' | 'missing';

type FormsEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

type SkyformsForm = {
  id: string;
  title: string;
  description?: string;
  schema: unknown[];
  status: number;
  allowAnonymousResponses: boolean;
  allowMultipleResponses: boolean;
  requiresManualReview: boolean;
};

async function bearer(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const res = await fetch('/api/auth/token', { credentials: 'include' });
  if (!res.ok) return null;
  const body = (await res.json()) as { token?: string };
  return body.token ?? null;
}

async function formsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await bearer();
  const headers: Record<string, string> = {};
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(`${CORE_API_URL}${path}`, { ...init, credentials: 'include', headers });
  const text = await res.text();
  let body: FormsEnvelope<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as FormsEnvelope<T>) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new ProblemError(res.status, body?.message || `HTTP ${res.status}`);
  }
  return (body && 'data' in body ? body.data : (body as T)) as T;
}

export async function readFormGate(formId: string): Promise<FormGate> {
  try {
    await formsFetch(`/api/forms/${formId}/meta`);
    return 'open';
  } catch (err) {
    if (err instanceof ProblemError && err.status === 410) return 'closed';
    if (err instanceof ProblemError && err.status === 404) return 'missing';
    throw err;
  }
}

function upsertFrom(form: SkyformsForm, status: number) {
  return {
    id: form.id,
    title: form.title,
    description: form.description ?? '',
    schema: form.schema ?? [],
    status,
    allowAnonymousResponses: form.allowAnonymousResponses,
    allowMultipleResponses: form.allowMultipleResponses,
    requiresManualReview: form.requiresManualReview,
  };
}

export async function setFormGate(formId: string, open: boolean): Promise<FormGate> {
  const form = await formsFetch<SkyformsForm>(`/api/admin/forms/${formId}`);
  const status = open ? FORM_STATUS_OPEN : FORM_STATUS_CLOSED;
  await formsFetch(`/api/admin/forms/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(upsertFrom(form, status)),
  });
  return open ? 'open' : 'closed';
}
