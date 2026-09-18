import { coreFetch } from './core';

export type CoreEvent = {
  id: string;
  name: string;
  description: string;
  location: string;
  ownerTeam: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
  capacity: number;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  active: boolean;
  ranked: boolean;
  prizeInfo?: string;
  seasonId?: string;
  coverImageId?: string;
  coverImageUrl?: string;
  attendanceRule?: string;
  attendanceRatio?: number;
  images?: { id: string; url?: string }[];
  imageUrls?: string[];
  doorStaffIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type EventBody = {
  id?: string;
  name: string;
  description: string;
  location: string;
  ownerTeam: string;
  formUrl?: string;
  formAlias?: string;
  extraFormUrls?: { label: string; url: string; alias?: string }[];
  capacity: number;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  active: boolean;
  ranked: boolean;
  prizeInfo?: string;
  coverImageId?: string;
  attendanceRule?: string;
  attendanceRatio?: number;
  doorStaffIds?: string[];
};

export const eventsApi = {
  list: (ownerTeam?: string) => {
    const q = ownerTeam ? `?ownerTeam=${encodeURIComponent(ownerTeam)}` : '';
    return coreFetch<CoreEvent[]>(`/v1/events${q}`);
  },
  get: (id: string) => coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`),
  create: (body: EventBody) =>
    coreFetch<CoreEvent>('/v1/events', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: EventBody) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addImages: (id: string, imageIds: string[]) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/images`, {
      method: 'POST',
      body: JSON.stringify(imageIds),
    }),
  removeImages: (id: string, imageIds: string[]) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/images`, {
      method: 'DELETE',
      body: JSON.stringify(imageIds),
    }),
};
