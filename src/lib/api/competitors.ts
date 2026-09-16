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
  list: () => coreFetch<Competitor[]>('/v1/competitors'),
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
  listByEvent: (eventId: string) =>
    coreFetch<Competitor[]>(`/v1/events/${encodeURIComponent(eventId)}/competitors`),
};
