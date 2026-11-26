import type { EventStat } from './dashboard';
import type { EventFile, EventVideo } from './uploads';
import { coreFetch } from './core';
import type { EntryMode } from './tickets';

export type CoreEvent = {
  id: string;
  name: string;
  description: string;
  location: string;
  /** The place's point (WGS 84, six decimals), both or neither; left out while empty. */
  locationLat?: number;
  locationLng?: number;
  /** The street address, at most 300 characters; left out while empty. */
  locationAddress?: string;
  /**
   * The map core drew of the point (docs/event-map.md), about a minute after
   * the point is saved; with the credit to print under it, linked.
   */
  mapImageUrl?: string;
  mapAttribution?: string;
  mapAttributionUrl?: string;
  ownerTeam: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
  /**
   * Where people register when the sign-up runs on another product's form
   * (Microsoft Forms and the like): an https address, left out for none (core
   * docs/attendee-import.md); public, for a "Kayıt ol" that opens it.
   */
  externalRegistrationUrl?: string;
  /**
   * The feedback form (etkinlik geri bildirim formu): not a Form slot, its
   * answers write no Ticket. `feedbackAutoSend` mails it two hours after the
   * Event ends to whom checked in; an older core sends none of these.
   */
  feedbackMode?: FeedbackMode;
  feedbackFormUrl?: string;
  feedbackFormAlias?: string;
  feedbackAutoSend?: boolean;
  capacity: number;
  /**
   * A full Event puts a registration on its waiting list while on (core
   * docs/event-capacity.md, default true); an older core sends none.
   */
  waitlistEnabled?: boolean;
  /**
   * The door's mode (core docs/venue-entry.md): `per_session`, `venue`, or `null` for automatic
   * (`venue` without a live session). `effectiveEntryMode` is what applies now. Absent before
   * core #413.
   */
  entryMode?: EntryMode | null;
  effectiveEntryMode?: EntryMode;
  /**
   * The door's mails (core docs/attendance-mail.md), on unless off: "hoş geldin" on the day's
   * first entry, "katılımın alındı" on each session check-in. Absent before core's door mails.
   */
  attendanceWelcomeMail?: boolean;
  attendanceRecordedMail?: boolean;
  /**
   * The organizer's note for whoever enters (Wi-Fi, the room), sent in the welcome mail alone:
   * only to who may edit the event, `""` for none; absent otherwise and before core's door mails.
   */
  attendeeNote?: string;
  /**
   * A linked form's newly accepted answer gets its Ticket by itself (core
   * docs/form-respondents.md, default true); off, it waits on Katılımcılar. Absent before core's
   * form respondents.
   */
  formResponsesAutoTicket?: boolean;
  /** `capacity > 0` and the active Tickets fill it. */
  full?: boolean;
  /** The active Tickets; only for who may edit the Event. */
  ticketCount?: number;
  /** The waitlisted Tickets; only for who may edit the Event. */
  waitlistCount?: number;
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
  /** none, once, count, or an older Event's ratio (core docs/certificate-rule.md). */
  attendanceRule?: string;
  attendanceRatio?: number;
  /** The count rule's threshold; left out for the default ⌈3N/4⌉. */
  attendanceMinCount?: number;
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

/**
 * A place Events were held at (GET /v1/events/places, core
 * docs/event-location.md): one per name and point, the latest used first.
 */
export type EventPlace = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  lastUsedAt: string;
  uses: number;
};

/** POST /v1/events/{id}/copy (core docs/event-copy.md). */
export type EventCopyBody = {
  /** Made once per dialog: a retried request answers the copy it made. */
  id: string;
  name: string;
  startDate: string;
  includeDoorStaff?: boolean;
  includeCompetitions?: boolean;
  /** None: the external registration link is not copied. */
  includeExternalRegistration?: boolean;
  /** None: the attendee note is not copied. */
  includeAttendeeNote?: boolean;
  /** Left out or true: the certificate template comes along (its own one as the copy's own). */
  includeCertificateTemplate?: boolean;
  /** None: the source's Owner team. */
  ownerTeam?: string;
};

/** The copy, a draft, and the parts core left out (`cover`, `certificateTemplate`, …). */
export type EventCopy = { event: CoreEvent; skipped: string[] };

/**
 * Where the feedback questions are: the Event's one form (`event`), a form of
 * each Session (`per_session`), or the Sessions asked inside the Event's form
 * (`event_with_sessions`).
 */
export type FeedbackMode = 'event' | 'per_session' | 'event_with_sessions';

/** How many invites a form went out in and how many were answered. */
export type FeedbackCount = { sessionId?: string; sent: number; answered: number };

export type FeedbackCounts = { event: FeedbackCount; sessions: FeedbackCount[] };

/** "Şimdi gönder": `sent` false when the form went already. */
export type FeedbackSendResult = { sent: boolean; recipients?: number };

export type EventBody = {
  id?: string;
  name: string;
  description: string;
  location: string;
  /** Both or neither (`400 event_location_invalid`). */
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  ownerTeam: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
  /** An https address; none for none (`400 external_registration_url_invalid`). */
  externalRegistrationUrl?: string;
  feedbackMode?: FeedbackMode;
  feedbackFormUrl?: string;
  feedbackFormAlias?: string;
  feedbackAutoSend?: boolean;
  capacity: number;
  /** Left out: core's default (on). */
  waitlistEnabled?: boolean;
  /** Left out or `null`: automatic. */
  entryMode?: EntryMode | null;
  /** Left out: core's default (on). */
  attendanceWelcomeMail?: boolean;
  attendanceRecordedMail?: boolean;
  attendeeNote?: string;
  /** Left out: core's default (on). */
  formResponsesAutoTicket?: boolean;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  ranked: boolean;
  prizeInfo?: string;
  coverImageId?: string;
  attendanceRule?: string;
  attendanceRatio?: number;
  /** The count rule's threshold; none for the default ⌈3N/4⌉. */
  attendanceMinCount?: number | null;
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
  /** `null` for both clears the point; one alone is refused. */
  locationLat?: number | null;
  locationLng?: number | null;
  locationAddress?: string | null;
  ownerTeam?: string;
  formUrl?: string | null;
  formAlias?: string | null;
  extraFormUrls?: { label: string; url: string; alias?: string }[] | null;
  /** `null` or `""` clears it. */
  externalRegistrationUrl?: string | null;
  feedbackMode?: FeedbackMode;
  feedbackFormUrl?: string | null;
  feedbackFormAlias?: string | null;
  feedbackAutoSend?: boolean;
  capacity?: number | null;
  /** Takes no `null` (400). */
  waitlistEnabled?: boolean;
  /** `null` back to automatic. */
  entryMode?: EntryMode | null;
  /** Take no `null` (400). */
  attendanceWelcomeMail?: boolean;
  attendanceRecordedMail?: boolean;
  /** `""` or `null` clears it. */
  attendeeNote?: string | null;
  /** Takes no `null` (400). */
  formResponsesAutoTicket?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  linkedin?: string | null;
  ranked?: boolean;
  prizeInfo?: string | null;
  coverImageId?: string | null;
  attendanceRule?: string | null;
  attendanceRatio?: number | null;
  attendanceMinCount?: number | null;
  doorStaffIds?: string[] | null;
  registrationClosed?: boolean;
  registrationClosesAt?: string | null;
  cancelReason?: string | null;
  /**
   * Whether a published Event's new start, end or location is told to its Ticket holders
   * (core docs/event-updated-notification.md); left out, core tells them. Takes no `null`.
   */
  notifyTicketHolders?: boolean;
};

/** GET /v1/dashboard/event-stats: one row per covered Event, undated ones last. */
export type EventStatsAnswer = {
  generatedAt: string;
  timeZone: 'Europe/Istanbul';
  eventStats: EventStat[];
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
  get: (id: string, init?: RequestInit) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`, init),
  /**
   * The figures of every Event whose applicants the caller may read, past and
   * undated ones too (core-backend docs/dashboard-summary.md, Event stats):
   * the list's registrations, entries and 14-day trend in one request.
   */
  stats: () => coreFetch<EventStatsAnswer>('/v1/dashboard/event-stats'),
  /**
   * The places of earlier Events: a team's (drafts too) for who creates
   * Events in it, or without `ownerTeam` the club's for event:manage; 403
   * for anyone else.
   */
  places: (ownerTeam?: string, limit = 20) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (ownerTeam) query.set('ownerTeam', ownerTeam);
    return coreFetch<EventPlace[]>(`/v1/events/places?${query.toString()}`);
  },
  create: (body: EventBody) =>
    coreFetch<CoreEvent>('/v1/events', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /**
   * draft → published; core refuses an Event without a name, place or start
   * (`event_incomplete`). `notifyTicketHolders` mails the Tickets written
   * while it was a draft "biletin hazır"; without a body nobody is mailed.
   */
  publish: (id: string, body?: { notifyTicketHolders: boolean }) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
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
  /** The feedback forms' counts; the Event's editors and DK. */
  feedbackCounts: (id: string) =>
    coreFetch<FeedbackCounts>(`/v1/events/${encodeURIComponent(id)}/feedback`),
  /**
   * "Şimdi gönder": the Event's feedback form to whom checked in, at once and
   * once (`feedback_form_missing`, `feedback_not_sendable` refuse it).
   */
  sendFeedback: (id: string) =>
    coreFetch<FeedbackSendResult>(`/v1/events/${encodeURIComponent(id)}/feedback/send`, {
      method: 'POST',
    }),
  /** The feedback form was closed in Skyforms: its reminders still to go are cancelled for good. */
  closeFeedback: (id: string) =>
    coreFetch<{ cancelled: number }>(`/v1/events/${encodeURIComponent(id)}/feedback/close`, {
      method: 'POST',
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
