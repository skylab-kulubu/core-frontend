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
  checkIns: CheckIn[];
  createdAt: string;
  updatedAt: string;
  event?: { id?: string; name?: string };
};

export const ticketsApi = {
  listByEvent: (eventId: string) =>
    coreFetch<Ticket[]>(`/v1/events/${encodeURIComponent(eventId)}/tickets`),
  get: (id: string) => coreFetch<Ticket>(`/v1/tickets/${encodeURIComponent(id)}`),
  applyMe: (eventId: string) =>
    coreFetch<Ticket>(`/v1/events/${encodeURIComponent(eventId)}/applications/me`, {
      method: 'POST',
    }),
  checkIn: (ticketId: string, sessionId: string) =>
    coreFetch<CheckIn>(
      `/v1/tickets/${encodeURIComponent(ticketId)}/sessions/${encodeURIComponent(sessionId)}/check-in`,
      { method: 'POST' },
    ),
};
