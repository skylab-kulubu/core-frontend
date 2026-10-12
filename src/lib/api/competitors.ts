import { coreFetch } from './core';

export type Competitor = {
  id: string;
  userId: string;
  eventId: string;
  score?: number;
  isWinner: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompetitorBody = {
  userId: string;
  eventId: string;
  score?: number;
  isWinner: boolean;
};

export const competitorsApi = {
  get: (id: string) => coreFetch<Competitor>(`/v1/competitors/${encodeURIComponent(id)}`),
  create: (body: CompetitorBody) =>
    coreFetch<Competitor>('/v1/competitors', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: CompetitorBody) =>
    coreFetch<Competitor>(`/v1/competitors/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/competitors/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** Brings back a competitor its delete withdrew (Geri al). */
  reinstate: (id: string) =>
    coreFetch<Competitor>(`/v1/competitors/${encodeURIComponent(id)}/reinstate`, {
      method: 'POST',
    }),
  listByEvent: (eventId: string) =>
    coreFetch<Competitor[]>(`/v1/events/${encodeURIComponent(eventId)}/competitors`),
};
