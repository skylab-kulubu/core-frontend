import { coreFetch } from './core';

export type CheckIn = {
  id: string;
  ticketId: string;
  eventDayId: string;
  createdAt: string;
};

export const ticketsApi = {
  checkIn: (ticketId: string, eventDayId: string) =>
    coreFetch<CheckIn>(
      `/v1/tickets/${encodeURIComponent(ticketId)}/event-days/${encodeURIComponent(eventDayId)}/check-in`,
      { method: 'POST' },
    ),
};
