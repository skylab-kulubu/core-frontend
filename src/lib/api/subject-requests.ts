import { coreFetch } from './core';

/** How the request reached the club. */
export type SubjectRequestChannel = 'email' | 'post' | 'in_person';

/** KVKK md. 11/1's clauses, and other (a consent withdrawal or photo objection sent the same way). */
export type SubjectRequestType =
  | 'learn'
  | 'info'
  | 'purpose'
  | 'recipients'
  | 'rectify'
  | 'erase'
  | 'notify_recipients'
  | 'object_automated'
  | 'compensation'
  | 'other';

export type SubjectRequestStatus = 'received' | 'awaiting_verification' | 'answered' | 'rejected';

export type SubjectRequestEvent = {
  at: string;
  actorId: string | null;
  action: 'create' | 'update';
  /** The names of the fields the change wrote; core keeps no value. */
  fields: string[];
  status: SubjectRequestStatus;
};

/** A KVKK md. 11 request in core's register (core docs/subject-requests.md). Dates are YYYY-MM-DD. */
export type SubjectRequest = {
  id: string;
  receivedOn: string;
  channel: SubjectRequestChannel;
  requesterName: string;
  requesterContact: string;
  userId: string | null;
  requestTypes: SubjectRequestType[];
  status: SubjectRequestStatus;
  /** receivedOn + 30 days (KVKK md. 13), core's. */
  dueOn: string;
  answeredOn: string | null;
  answerSummary: string;
  responder: string;
  createdAt: string;
  updatedAt: string;
  /** Only on a single request. */
  events?: SubjectRequestEvent[];
};

export type SubjectRequestBody = {
  receivedOn: string;
  channel: SubjectRequestChannel;
  requesterName: string;
  requesterContact: string;
  userId: string | null;
  requestTypes: SubjectRequestType[];
  status: SubjectRequestStatus;
  answeredOn: string | null;
  answerSummary: string;
  responder: string;
};

export const subjectRequestsApi = {
  list: () => coreFetch<SubjectRequest[]>('/v1/subject-requests'),
  get: (id: string) => coreFetch<SubjectRequest>(`/v1/subject-requests/${encodeURIComponent(id)}`),
  create: (body: SubjectRequestBody) =>
    coreFetch<SubjectRequest>('/v1/subject-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Writes the fields sent; null empties userId and answeredOn. */
  update: (id: string, body: Partial<SubjectRequestBody>) =>
    coreFetch<SubjectRequest>(`/v1/subject-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
