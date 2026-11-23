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

/** A short-lived QR the door shows for guests to check themselves in; token and url are secrets. */
export type DoorQr = {
  token: string;
  url: string;
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
};

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
  listByEvent: (eventId: string) =>
    coreFetch<Ticket[]>(`/v1/events/${encodeURIComponent(eventId)}/tickets`),
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
  createDoorQr: (sessionId: string) =>
    coreFetch<DoorQr>(`/v1/sessions/${encodeURIComponent(sessionId)}/door-qr?svg=1`, {
      method: 'POST',
    }),
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
  /** Live: the door page asks every few seconds, never from the kept reads. */
  doorActivity: (sessionId: string) =>
    coreFetch<DoorActivity>(`/v1/sessions/${encodeURIComponent(sessionId)}/check-ins`, {
      cache: 'no-store',
    }),
};
