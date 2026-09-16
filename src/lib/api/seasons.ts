import { coreFetch } from './core';
import type { CoreEvent } from './events';

export type Season = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SeasonBody = {
  name: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
};

export const seasonsApi = {
  list: (activeOnly = false) =>
    coreFetch<Season[]>(`/v1/seasons${activeOnly ? '?active=true' : ''}`),
  get: (id: string) => coreFetch<Season>(`/v1/seasons/${encodeURIComponent(id)}`),
  create: (body: SeasonBody) =>
    coreFetch<Season>('/v1/seasons', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: SeasonBody) =>
    coreFetch<Season>(`/v1/seasons/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/seasons/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listEvents: (id: string) =>
    coreFetch<CoreEvent[]>(`/v1/seasons/${encodeURIComponent(id)}/events`),
  assignEvent: (seasonId: string, eventId: string) =>
    coreFetch<CoreEvent>(
      `/v1/seasons/${encodeURIComponent(seasonId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'POST' },
    ),
};
