import type { EventFile, EventVideo } from './uploads';
import { coreFetch } from './core';

export type CoreEvent = {
  id: string;
  name: string;
  description: string;
  location: string;
  ownerTeam: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
  capacity: number;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  /** Derived by core: published and not ended (ADR 0066). */
  active: boolean;
  /** The stored status; an older core sent none (read as published). */
  status?: EventStatus;
  publishedAt?: string;
  cancelledAt?: string;
  /** The public reason of a cancellation, empty when none was given. */
  cancelReason?: string;
  /** Set while the cancellation mail to the Ticket holders is queued or sent. */
  cancelNotifiedAt?: string;
  /** The Event this one was copied from (POST /v1/events/{id}/copy). */
  copiedFromEventId?: string;
  /** Closed by hand; `registrationClosesAt` is the deadline (none: no deadline). */
  registrationClosed?: boolean;
  registrationClosesAt?: string;
  /** Derived by core: published, not ended, not closed by hand and before the deadline. */
  registrationOpen?: boolean;
  ranked: boolean;
  prizeInfo?: string;
  seasonId?: string;
  coverImageId?: string;
  coverImageUrl?: string;
  attendanceRule?: string;
  attendanceRatio?: number;
  images?: { id: string; url?: string }[];
  imageUrls?: string[];
  doorStaffIds?: string[];
  /** The Event's files and videos, in its detail only; lists carry the counts alone. */
  files?: EventFile[];
  videos?: EventVideo[];
  fileCount?: number;
  videoCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type EventStatus = 'draft' | 'published' | 'cancelled';

/** POST /v1/events/{id}/copy (core docs/event-copy.md). */
export type EventCopyBody = {
  /** Made once per dialog: a retried request answers the copy it made. */
  id: string;
  name: string;
  startDate: string;
  includeDoorStaff?: boolean;
  includeCompetitions?: boolean;
  /** None: the source's Owner team. */
  ownerTeam?: string;
};

/** The copy, a draft, and the parts core left out (`cover`, `certificateTemplate`, …). */
export type EventCopy = { event: CoreEvent; skipped: string[] };

export type EventBody = {
  id?: string;
  name: string;
  description: string;
  location: string;
  ownerTeam: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
  capacity: number;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  ranked: boolean;
  prizeInfo?: string;
  coverImageId?: string;
  attendanceRule?: string;
  attendanceRatio?: number;
  doorStaffIds?: string[];
  /** The deadline of applying; none: no deadline. */
  registrationClosesAt?: string;
  /** Read on create alone: the panel opens every new Event as a draft (ADR 0066). */
  status?: 'draft';
};

/**
 * A partial update (PUT and PATCH alike in core, ADR 0066 addendum): a key
 * left out keeps its value; `null` (or `""`, `[]`) clears a field that may be
 * empty. `name`, `location` and `ownerTeam` cannot be cleared, `ranked` and
 * `registrationClosed` take no `null`.
 */
export type EventPatch = {
  name?: string;
  description?: string;
  location?: string;
  ownerTeam?: string;
  formUrl?: string | null;
  formAlias?: string | null;
  extraFormUrls?: { label: string; url: string; alias?: string }[] | null;
  capacity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  linkedin?: string | null;
  ranked?: boolean;
  prizeInfo?: string | null;
  coverImageId?: string | null;
  attendanceRule?: string | null;
  attendanceRatio?: number | null;
  doorStaffIds?: string[] | null;
  registrationClosed?: boolean;
  registrationClosesAt?: string | null;
  cancelReason?: string | null;
};

export const eventsApi = {
  /**
   * The current Events, or with `lifecycle` the archived (`inactive`) ones
   * or both (`all`); core returns only the archived Events the caller may
   * delete. `drafts` adds the drafts the caller may see (their editors, DK).
   */
  list: (ownerTeam?: string, lifecycle?: 'inactive' | 'all', options?: { drafts?: boolean }) => {
    const query = new URLSearchParams();
    if (ownerTeam) query.set('ownerTeam', ownerTeam);
    if (lifecycle) query.set('lifecycle', lifecycle);
    if (options?.drafts) query.set('drafts', 'include');
    const q = query.toString();
    return coreFetch<CoreEvent[]>(`/v1/events${q ? `?${q}` : ''}`);
  },
  get: (id: string) => coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`),
  create: (body: EventBody) =>
    coreFetch<CoreEvent>('/v1/events', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** draft → published; core refuses an Event without a name, place or start (`event_incomplete`). */
  publish: (id: string) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  /** published → draft, only while it has no Ticket (`event_has_tickets`). */
  unpublish: (id: string) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }),
  cancel: (id: string, body: { reason?: string; notifyTicketHolders: boolean }) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uncancel: (id: string, body: { notifyTicketHolders: boolean }) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/uncancel`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Writes only the fields sent; core keeps every other one. */
  patch: (id: string, body: EventPatch) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Copies the Event's structure into a new draft (ADR 0066); 200 or 201 alike. */
  copy: (id: string, body: EventCopyBody) =>
    coreFetch<EventCopy>(`/v1/events/${encodeURIComponent(id)}/copy`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** The Event's current Competitions (ADR 0068), for the copy dialog's count. */
  listCompetitions: (id: string) =>
    coreFetch<Array<{ id: string; name: string }>>(
      `/v1/events/${encodeURIComponent(id)}/competitions`,
    ),
  /** Brings back an Event its delete archived (Geri al). */
  restore: (id: string) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  addImages: (id: string, imageIds: string[]) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/images`, {
      method: 'POST',
      body: JSON.stringify(imageIds),
    }),
  removeImages: (id: string, imageIds: string[]) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/images`, {
      method: 'DELETE',
      body: JSON.stringify(imageIds),
    }),
  syncMailList: (id: string, ticketIds?: string[]) =>
    coreFetch<EventMailList>(`/v1/events/${encodeURIComponent(id)}/mail-list`, {
      method: 'POST',
      body: ticketIds ? JSON.stringify({ ticketIds }) : undefined,
    }),
};

export type EventMailList = {
  mailListId: string;
  name: string;
  recipientCount: number;
};
