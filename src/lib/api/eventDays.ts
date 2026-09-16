import { coreFetch } from './core';
import type { EventSession } from './sessions';

export type EventDay = {
  id: string;
  eventId: string;
  name: string;
  startDate?: string;
  endDate?: string;
};

export type EventDayBody = {
  eventId: string;
  name: string;
  startDate?: string;
  endDate?: string;
};

export const eventDaysApi = {
  listByEvent: (eventId: string) =>
    coreFetch<EventDay[]>(`/v1/events/${encodeURIComponent(eventId)}/days`),
  get: (id: string) => coreFetch<EventDay>(`/v1/event-days/${encodeURIComponent(id)}`),
  create: (body: EventDayBody) =>
    coreFetch<EventDay>('/v1/event-days', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Omit<EventDayBody, 'eventId'>) =>
    coreFetch<EventDay>(`/v1/event-days/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/event-days/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listSessions: (dayId: string) =>
    coreFetch<EventSession[]>(`/v1/event-days/${encodeURIComponent(dayId)}/sessions`),
};
