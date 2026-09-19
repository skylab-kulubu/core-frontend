import { CORE_API_URL, coreFetch } from './core';
import { eventDaysApi } from './eventDays';
import { eventsApi, type CoreEvent } from './events';
import { qrLogoQuery } from '@/lib/qr-url';

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

export const SESSION_TYPE_LABELS: Record<(typeof SESSION_TYPES)[number], string> = {
  WORKSHOP: 'Atölye',
  PRESENTATION: 'Sunum',
  PANEL: 'Panel',
  KEYNOTE: 'Açılış konuşması',
  NETWORKING: 'Networking',
  OTHER: 'Diğer',
  CTF: 'CTF',
  HACKATHON: 'Hackathon',
  JAM: 'Jam',
};

export function sessionTypeLabel(type: string): string {
  return type in SESSION_TYPE_LABELS
    ? SESSION_TYPE_LABELS[type as (typeof SESSION_TYPES)[number]]
    : type;
}

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

export function sessionQrPath(id: string, opts?: { size?: number }): string {
  return `/v1/sessions/${encodeURIComponent(id)}/qr${qrLogoQuery(opts)}`;
}

export function sessionQrUrl(id: string, opts?: { size?: number }): string {
  return `${CORE_API_URL}${sessionQrPath(id, opts)}`;
}

export function sessionQrFileName(id: string, title?: string): string {
  const label = title
    ?.trim()
    .replace(/[/\\?%*:|"<>]+/g, '')
    .replace(/\s+/g, '-');
  return `oturum-${label || id}.png`;
}

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
