import { coreFetch } from './core';
import type { Person } from './identity';

export type CheckIn = {
  id: string;
  ticketId: string;
  sessionId: string;
  eventDayId: string;
  createdAt: string;
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
  listDoorEvents: () => coreFetch<DoorEvent[]>('/v1/door/events'),
  searchDoorAttendees: (eventId: string, query: string) => {
    const params = new URLSearchParams({ q: query.trim() });
    return coreFetch<DoorAttendee[]>(
      `/v1/events/${encodeURIComponent(eventId)}/door-attendees?${params.toString()}`,
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
  resolveAndCheckIn: (sessionId: string, target: { personId?: string; query?: string }) =>
    coreFetch<DoorCheckIn>(`/v1/sessions/${encodeURIComponent(sessionId)}/check-in/resolve`, {
      method: 'POST',
      body: JSON.stringify(target),
    }),
  doorActivity: (sessionId: string) =>
    coreFetch<DoorActivity>(`/v1/sessions/${encodeURIComponent(sessionId)}/check-ins`),
};
