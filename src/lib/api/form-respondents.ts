import { coreFetch } from './core';

/**
 * A form question as core reads it from Forms (core docs/form-mappings.md): `identity` is the
 * form's own name/e-mail field, `inputType` the short text's kind (`email`, `name`, …).
 */
export type FormQuestion = {
  id: string;
  type: string;
  question: string;
  inputType?: string;
  identity?: string;
};

/** Which question holds each part of a guest; a question id or null. */
export type FormMapping = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
};

export type FormQuestions = {
  formId: string;
  title: string;
  questions: FormQuestion[];
  /** What the form's identity fields give (K5); the rest is null. */
  suggestion: FormMapping;
};

export type SavedFormMapping = FormMapping & { updatedAt?: string };

/** The send counts (preview and send alike, core docs/form-respondents.md). */
export type RespondentTicketPreview = {
  tickets: number;
  waitlisted: number;
  full: number;
  alreadyTicketed: number;
  pendingSkipped: number;
};

export type RespondentTicketResult = {
  recorded: number;
  waitlisted: number;
  full: number;
  skipped: number;
};

export type RespondentTicketJob = RespondentTicketResult & {
  jobId: string;
  formId?: string | null;
  state: 'queued' | 'running' | 'done' | 'failed';
  createdAt?: string;
  updatedAt?: string;
};

/** An Unticketed respondent: a form answer whose person holds no Ticket on the Event yet. */
export type FormRespondent = {
  id: string;
  formId: string;
  responseId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  submittedAt: string | null;
  formsStatus: 'accepted' | 'pending';
  source: 'collect' | 'new';
};

export type FormRespondentsPage = {
  items: FormRespondent[];
  nextCursor: string | null;
  total: number;
  /** A gathering of the Event's forms waits or runs. */
  collecting: boolean;
  /** Answers the last full gatherings kept no row for (core K3); absent before core sent it. */
  incomplete?: RespondentIncomplete;
};

export type RespondentIncomplete = {
  /** No first and last name (a one-word full name too). */
  missingName: number;
  /** No plain e-mail address. */
  missingEmail: number;
  /** No sign-in, no named guest, no mapping. */
  noPerson: number;
};

export type RespondentsQuery = {
  formId?: string;
  formsStatus?: 'accepted' | 'pending';
  q?: string;
  after?: string;
  limit?: number;
};

/** Who a send or preview is for: chosen rows, or every row of the Event (of `formId`). */
export type RespondentSelection = { ids: string[] } | { all: true; formId?: string };

const formPath = (eventId: string, formId: string) =>
  `/v1/events/${encodeURIComponent(eventId)}/forms/${encodeURIComponent(formId)}`;

const respondentsPath = (eventId: string) =>
  `/v1/events/${encodeURIComponent(eventId)}/respondents`;

export const formRespondentsApi = {
  list: (eventId: string, query: RespondentsQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return coreFetch<FormRespondentsPage>(`${respondentsPath(eventId)}${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    });
  },
  /** `503 forms_pull_off` while core reads no Forms; `403 forms_access_denied` for someone not on the form's team in Forms. */
  questions: (eventId: string, formId: string) =>
    coreFetch<FormQuestions>(`${formPath(eventId, formId)}/questions`, { cache: 'no-store' }),
  /** `404 mapping_not_found` before the first save. */
  mapping: (eventId: string, formId: string) =>
    coreFetch<SavedFormMapping>(`${formPath(eventId, formId)}/mapping`, { cache: 'no-store' }),
  /** 201 the first time, 200 after; the first save queues the form's gathering. */
  saveMapping: (eventId: string, formId: string, mapping: FormMapping) =>
    coreFetch<SavedFormMapping>(`${formPath(eventId, formId)}/mapping`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    }),
  previewTickets: (eventId: string, selection: RespondentSelection) =>
    coreFetch<RespondentTicketPreview>(`${respondentsPath(eventId)}/tickets/preview`, {
      method: 'POST',
      body: JSON.stringify(selection),
    }),
  /** `ids`: sent at once (200 counts); `all`: a background job (202 `{jobId}`). */
  sendTickets: (eventId: string, selection: RespondentSelection) =>
    coreFetch<RespondentTicketResult | { jobId: string }>(`${respondentsPath(eventId)}/tickets`, {
      method: 'POST',
      body: JSON.stringify(selection),
    }),
  ticketJob: (eventId: string, jobId: string) =>
    coreFetch<RespondentTicketJob>(
      `${respondentsPath(eventId)}/ticket-jobs/${encodeURIComponent(jobId)}`,
      { cache: 'no-store' },
    ),
};
