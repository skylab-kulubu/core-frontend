import { bearer, CORE_API_URL, ProblemError } from '@/lib/api/core';

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

/**
 * A form's theme from its public meta (`brand`, Forms' key such as `artlab`), `null` for SKY LAB's
 * own look, a closed or missing form, or an answer without the field.
 */
export async function readFormBrand(formId: string): Promise<string | null> {
  try {
    const meta = await formsFetch<{ brand?: unknown } | null>(
      `/api/forms/${encodeURIComponent(formId)}/meta`,
    );
    return typeof meta?.brand === 'string' && meta.brand ? meta.brand : null;
  } catch (err) {
    if (err instanceof ProblemError && (err.status === 404 || err.status === 410)) return null;
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

/** Forms' CollaboratorRole: what the signed-in person is on a form. */
export const FORM_ROLE_VIEWER = 1;
export const FORM_ROLE_EDITOR = 2;
export const FORM_ROLE_OWNER = 3;

/** A row of the person's forms (`GET /api/admin/forms/`, FormSummaryContract). */
export type MyForm = {
  id: string;
  title: string;
  /** 2 open, 1 closed. */
  status: number;
  /** 1 viewer, 2 editor, 3 owner. */
  userRole: number;
  responseCount: number;
  updatedAt?: string | null;
};

export type MyFormsPage = {
  items: MyForm[];
  totalCount: number;
  page: number;
  pageSize: number;
};

/**
 * The forms the signed-in person sees in Forms (owner, editor or viewer), newest change first,
 * with the person's own token: no new right (SPEC form-alan-eslestirme K2).
 */
export async function listMyForms(
  query: { search?: string; page?: number; pageSize?: number } = {},
): Promise<MyFormsPage> {
  const params = new URLSearchParams({
    Page: String(query.page ?? 1),
    PageSize: String(query.pageSize ?? 20),
    SortBy: 'updatedAt',
    SortDirection: 'descending',
  });
  const search = query.search?.trim();
  if (search) params.set('Search', search);
  const page = await formsFetch<Partial<MyFormsPage> | null>(`/api/admin/forms/?${params}`);
  return {
    items: page?.items ?? [],
    totalCount: page?.totalCount ?? 0,
    page: page?.page ?? query.page ?? 1,
    pageSize: page?.pageSize ?? query.pageSize ?? 20,
  };
}

/** A form's answer counts (`GET /api/admin/forms/{id}/metrics`); archived answers are left out. */
export type FormAnswerCounts = {
  /** Accepted: sent to a form without review, or approved. */
  accepted: number;
  /** Waiting for review in Forms (unverified ones included). */
  pending: number;
};

export async function readFormAnswerCounts(formId: string): Promise<FormAnswerCounts> {
  const metrics = await formsFetch<{
    totalResponses?: number;
    pendingCount?: number;
    rejectedCount?: number;
  }>(`/api/admin/forms/${encodeURIComponent(formId)}/metrics`);
  const total = metrics?.totalResponses ?? 0;
  const pending = metrics?.pendingCount ?? 0;
  const rejected = metrics?.rejectedCount ?? 0;
  return { accepted: Math.max(0, total - pending - rejected), pending };
}

/** A form's title, read with the person's token (`GET /api/admin/forms/{id}`). */
export async function readFormTitle(formId: string): Promise<string> {
  const form = await formsFetch<SkyformsForm>(`/api/admin/forms/${encodeURIComponent(formId)}`);
  return form?.title ?? '';
}
