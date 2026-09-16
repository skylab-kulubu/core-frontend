import { coreFetch } from './core';

export type CheckIn = {
  id: string;
  ticketId: string;
  eventDayId: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  eventId: string;
  ticketType: 'REGISTERED' | 'GUEST' | string;
  ownerId?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhoneNumber?: string;
  checkIns: CheckIn[];
  createdAt: string;
  updatedAt: string;
};

export const ticketsApi = {
  listByEvent: (eventId: string) =>
    coreFetch<Ticket[]>(`/v1/events/${encodeURIComponent(eventId)}/tickets`),
  checkIn: (ticketId: string, eventDayId: string) =>
    coreFetch<CheckIn>(
      `/v1/tickets/${encodeURIComponent(ticketId)}/event-days/${encodeURIComponent(eventDayId)}/check-in`,
      { method: 'POST' },
    ),
};
