import { coreFetch } from './core';
import { eventDaysApi } from './eventDays';
import { eventsApi, type CoreEvent } from './events';

export const SESSION_TYPES = [
  'WORKSHOP',
  'PRESENTATION',
  'PANEL',
  'KEYNOTE',
  'NETWORKING',
  'OTHER',
  'CTF',
  'HACKATHON',
  'JAM',
] as const;

export type EventSession = {
  id: string;
  eventDayId: string;
  title: string;
  speakerName: string;
  speakerLinkedin?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  orderIndex: number;
  sessionType: string;
};

export type SessionBody = {
  eventDayId: string;
  title: string;
  speakerName: string;
  speakerLinkedin?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  orderIndex: number;
  sessionType: string;
};

export type SessionRow = EventSession & {
  eventId: string;
  eventName: string;
  dayName: string;
};

export const sessionsApi = {
  get: (id: string) => coreFetch<EventSession>(`/v1/sessions/${encodeURIComponent(id)}`),
  create: (body: SessionBody) =>
    coreFetch<EventSession>('/v1/sessions', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: SessionBody) =>
    coreFetch<EventSession>(`/v1/sessions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async listAll(events?: CoreEvent[]): Promise<SessionRow[]> {
    const source = events ?? (await eventsApi.list());
    const nested = await Promise.all(
      source.map(async (event) => {
        const days = await eventDaysApi.listByEvent(event.id);
        const perDay = await Promise.all(
          days.map(async (day) => {
            const items = await eventDaysApi.listSessions(day.id);
            return items.map((session) => ({
              ...session,
              eventId: event.id,
              eventName: event.name,
              dayName: day.name,
            }));
          }),
        );
        return perDay.flat();
      }),
    );
    return nested.flat();
  },
};
