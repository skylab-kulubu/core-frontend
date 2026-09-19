import { coreFetch } from './core';

export type CheckIn = {
  id: string;
  ticketId: string;
  sessionId: string;
  eventDayId: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  eventId: string;
  ticketType: 'REGISTERED' | 'GUEST' | string;
  ownerId?: string;
  owner?: { id?: string; email?: string; firstName?: string; lastName?: string };
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhoneNumber?: string;
  guestUniversity?: string;
  guestFaculty?: string;
  guestDepartment?: string;
  guestGrade?: string;
  sent?: boolean;
  formId?: string;
  formUrl?: string;
  formAlias?: string;
  checkIns?: CheckIn[];
  createdAt: string;
  updatedAt: string;
  event?: { id?: string; name?: string };
};

export type GuestApplyBody = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
};

export const ticketsApi = {
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
  applyMe: (eventId: string) =>
    coreFetch<Ticket>(`/v1/events/${encodeURIComponent(eventId)}/applications/me`, {
      method: 'POST',
    }),
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
};
