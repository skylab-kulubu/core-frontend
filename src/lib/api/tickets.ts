import { coreFetch } from './core';
import type { Person } from './identity';

export type CheckIn = {
  id: string;
  ticketId: string;
  sessionId: string;
  eventDayId: string;
  createdAt: string;
  /** The holder's name, where core sends it (the camera scan does not yet). */
  personName?: string;
};

export type DoorEvent = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  location: string;
  ownerTeam: string;
  coverImageUrl?: string;
  active: boolean;
  ranked: boolean;
};

/**
 * `door`: the door screen, guests pass one by one (core caps a token at 20). `display`: the
 * attendance QR on the projector or OBS, a whole room scans one frame (cap 400).
 */
export type DoorQrUse = 'door' | 'display';
/** Core's SESSION_QR_MODE: in `qr` the static (printed) session QR no longer checks anyone in. */
export type SessionQrMode = 'open' | 'qr';

/** A short-lived QR the door shows for guests to check themselves in; token and url are secrets. */
export type DoorQr = {
  token: string;
  url: string;
  /** Older cores leave these out. */
  use?: DoorQrUse;
  maxUses?: number;
  sessionQrMode?: SessionQrMode;
  svg: string;
  sessionId: string;
  eventId: string;
  issuedAt: string;
  expiresAt: string;
  refreshAfterSeconds: number;
};

export type DoorCheckIn = {
  id: string;
  sessionId: string;
  eventDayId: string;
  personName: string;
  createdAt: string;
};

export type DoorActivity = {
  total: number;
  items: DoorCheckIn[];
};

export type DoorAttendee = {
  personId?: string;
  name: string;
  email: string;
};

export type TicketOwner = Pick<Person, 'id' | 'email' | 'firstName' | 'lastName'>;

export type Ticket = {
  id: string;
  eventId: string;
  ticketType: 'REGISTERED' | 'GUEST' | string;
  ownerId?: string;
  owner?: TicketOwner;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhoneNumber?: string;
  guestUniversity?: string;
  guestFaculty?: string;
  guestDepartment?: string;
  guestGrade?: string;
  /** The Ticket's code, `XXXX-XXXX` (Crockford Base32): found at the desk, not a credential. */
  code?: string;
  sent?: boolean;
  formId?: string;
  formUrl?: string;
  formAlias?: string;
  checkIns?: CheckIn[];
  createdAt: string;
  updatedAt: string;
  event?: { id?: string; name?: string };
  /** core docs/ticket-cancellation.md: only an active Ticket passes the door. Absent before core #405. */
  status?: TicketStatus;
  cancelledAt?: string;
  cancelledBy?: 'holder' | 'operator' | 'form' | string;
  cancelReason?: string;
  /** When a waitlisted Ticket went on the list: its place in it (core docs/event-capacity.md). */
  waitlistedAt?: string;
  /** On the answer of a panel write that went past the Event's capacity; never stored. */
  overCapacity?: boolean;
};

export type TicketStatus = 'active' | 'waitlisted' | 'cancelled';

/** "Bileti yeniden gönder": the n-th resend; `replayed` when the same key was sent before. */
export type TicketResend = { resend: number; replayed: boolean; queued: boolean };

/** "Bağlantıyı yenile": the Ticket (its code, never its key) and whether its mail was queued. */
export type RenewedTicket = Ticket & { notificationQueued: boolean; resend?: number };

export type GuestApplyBody = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
};

/** One row of an attendee list and what it does (preview) or did (import); core docs/attendee-import.md. */
export type ImportOutcome = 'active' | 'waitlisted' | 'full' | 'existing' | 'duplicate' | 'invalid';

export type ImportRow = {
  /** The row's line in the list, the header's being 1. */
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  sessions?: { id: string; title: string }[];
  unknownSessions?: string[];
  outcome: ImportOutcome;
  /** Why an invalid row is: missing_first_name, missing_last_name, invalid_email, name_too_long, account_unavailable. */
  problem?: string;
  /** An account holds the e-mail: the Ticket is the member's. */
  account: boolean;
  /** The Ticket already there, on an existing row. */
  ticketStatus?: 'active' | 'waitlisted' | 'cancelled';
  overCapacity?: boolean;
};

export type ImportReport = {
  imported: boolean;
  columns: {
    header: boolean;
    delimiter: 'comma' | 'semicolon' | 'tab';
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
    session?: string;
  };
  summary: {
    rows: number;
    active: number;
    waitlisted: number;
    full: number;
    existing: number;
    duplicates: number;
    invalid: number;
    overCapacity: number;
    members: number;
    guests: number;
    unknownSessions: number;
  };
  capacity: { capacity: number; active: number; free: number; waitlistEnabled: boolean };
  /** queued, off (the reader turned it off), notifications_off (core sends none), on_publish (a draft). */
  mail: 'queued' | 'off' | 'notifications_off' | 'on_publish';
  rows: ImportRow[];
};

export type ImportBody = {
  /** A CSV file's text or the pasted rows; core keeps none of it. */
  text: string;
  /** On when left out. */
  sendMail?: boolean;
  pastCapacity?: boolean;
};

export const ticketsApi = {
  listDoorEvents: () => coreFetch<DoorEvent[]>('/v1/door/events'),
  /** Live: a guest who just applied must show in the next search, never from the kept reads. */
  searchDoorAttendees: (eventId: string, query: string) => {
    const params = new URLSearchParams({ q: query.trim() });
    return coreFetch<DoorAttendee[]>(
      `/v1/events/${encodeURIComponent(eventId)}/door-attendees?${params.toString()}`,
      { cache: 'no-store' },
    );
  },
  listAssignableUsers: (eventId: string, query: string) => {
    const params = new URLSearchParams({ q: query.trim() });
    return coreFetch<Person[]>(
      `/v1/events/${encodeURIComponent(eventId)}/assignable-users?${params.toString()}`,
    );
  },
  /** The Event's active Tickets; `status` reads the cancelled (or waitlisted) ones instead. */
  listByEvent: (eventId: string, status?: Exclude<TicketStatus, 'active'>) =>
    coreFetch<Ticket[]>(
      `/v1/events/${encodeURIComponent(eventId)}/tickets${status ? `?status=${status}` : ''}`,
    ),
  list: (query: { email?: string; userId?: string }) => {
    const params = new URLSearchParams();
    if (query.email?.trim()) params.set('email', query.email.trim());
    if (query.userId?.trim()) params.set('userId', query.userId.trim());
    const qs = params.toString();
    return coreFetch<Ticket[]>(`/v1/tickets${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => coreFetch<Ticket>(`/v1/tickets/${encodeURIComponent(id)}`),
  byUserEvent: (userId: string, eventId: string) =>
    coreFetch<Ticket>(
      `/v1/tickets/user/${encodeURIComponent(userId)}/event/${encodeURIComponent(eventId)}`,
    ),
  applyForOther: (eventId: string, userId: string) =>
    coreFetch<Ticket>(
      `/v1/events/${encodeURIComponent(eventId)}/applications/users/${encodeURIComponent(userId)}`,
      { method: 'POST' },
    ),
  applyGuest: (eventId: string, body: GuestApplyBody) =>
    coreFetch<Ticket>(`/v1/events/${encodeURIComponent(eventId)}/applications/guest`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  checkIn: (ticketId: string, sessionId: string) =>
    coreFetch<CheckIn>(
      `/v1/tickets/${encodeURIComponent(ticketId)}/sessions/${encodeURIComponent(sessionId)}/check-in`,
      { method: 'POST' },
    ),
  resolveAndCheckIn: (sessionId: string, target: { personId?: string; query?: string }) =>
    coreFetch<DoorCheckIn>(`/v1/sessions/${encodeURIComponent(sessionId)}/check-in/resolve`, {
      method: 'POST',
      body: JSON.stringify(target),
    }),
  /**
   * What the door's camera read: a Ticket QR or a SkyPass code (core-backend
   * docs/ticket-qr.md). 401 `ticket_qr_invalid`, 410 `ticket_qr_superseded`,
   * 409 when the holder is already in.
   */
  scanCheckIn: (sessionId: string, token: string) =>
    coreFetch<CheckIn>(`/v1/sessions/${encodeURIComponent(sessionId)}/check-in/scan`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  /**
   * Takes back an entry the door wrote by mistake (204); who may write the entry may take it
   * back while the Event takes entries. 404 when the entry is gone or of another session.
   */
  undoCheckIn: (sessionId: string, checkInId: string) =>
    coreFetch<void>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/check-ins/${encodeURIComponent(checkInId)}`,
      { method: 'DELETE' },
    ),
  createDoorQr: (sessionId: string, use: DoorQrUse = 'door') =>
    coreFetch<DoorQr>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/door-qr?svg=1${use === 'display' ? '&use=display' : ''}`,
      { method: 'POST' },
    ),
  /**
   * The Ticket's "biletin hazır" mail again (core docs/ticket-resend.md):
   * 429 `ticket_resend_rate_limited` (3 an hour, 6 a day), 409 for a draft,
   * cancelled or ended Event, mails off or an erased holder, 503
   * `audit_unavailable`. The same `Idempotency-Key` sends one mail.
   */
  resend: (ticketId: string, idempotencyKey: string) =>
    coreFetch<TicketResend>(`/v1/tickets/${encodeURIComponent(ticketId)}/notification`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  /**
   * A new link and QR, the old ones void, and the mail with the new link; the
   * same refusals as `resend`, in which case nothing is renewed.
   */
  renewLink: (ticketId: string, idempotencyKey: string) =>
    coreFetch<RenewedTicket>(`/v1/tickets/${encodeURIComponent(ticketId)}/access-key/rotate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  /**
   * An operator cancels the Ticket (core docs/ticket-cancellation.md): the door refuses it.
   * 409 `event_ended`, `ticket_checked_in`, `ticket_in_competition`; 403 for who may not edit
   * the Event. A cancelled Ticket answers 200 as it is.
   */
  cancel: (ticketId: string, { reason, notify }: { reason?: string; notify?: boolean } = {}) =>
    coreFetch<Ticket>(`/v1/tickets/${encodeURIComponent(ticketId)}/cancel`, {
      method: 'POST',
      // `notify`: the holder is told (core #412; core before it ignores the field)
      body: JSON.stringify({
        ...(reason ? { reason } : {}),
        ...(notify !== undefined ? { notify } : {}),
      }),
    }),
  /** Takes the cancellation back: active again with a new link and QR. 409 `event_ended`. */
  restore: (ticketId: string) =>
    coreFetch<Ticket>(`/v1/tickets/${encodeURIComponent(ticketId)}/restore`, { method: 'POST' }),
  /**
   * "Öne al": a waitlisted Ticket becomes active, past the capacity if it must (`overCapacity`).
   * An active one answers as it is; 409 `ticket_cancelled`, `event_ended`; 403 as cancel.
   */
  /** What importing the list would do; writes nothing (core docs/attendee-import.md). */
  previewImport: (eventId: string, body: ImportBody) =>
    coreFetch<ImportReport>(`/v1/events/${encodeURIComponent(eventId)}/attendee-imports/preview`, {
      method: 'POST',
      body: JSON.stringify(body),
      cache: 'no-store',
    }),
  /** Writes the list's Tickets; the same list again writes nothing. */
  importAttendees: (eventId: string, body: ImportBody) =>
    coreFetch<ImportReport>(`/v1/events/${encodeURIComponent(eventId)}/attendee-imports`, {
      method: 'POST',
      body: JSON.stringify(body),
      cache: 'no-store',
    }),
  promote: (ticketId: string) =>
    coreFetch<Ticket>(`/v1/tickets/${encodeURIComponent(ticketId)}/promote`, { method: 'POST' }),
  /** Live: the door page asks every few seconds, never from the kept reads. */
  doorActivity: (sessionId: string) =>
    coreFetch<DoorActivity>(`/v1/sessions/${encodeURIComponent(sessionId)}/check-ins`, {
      cache: 'no-store',
    }),
};
