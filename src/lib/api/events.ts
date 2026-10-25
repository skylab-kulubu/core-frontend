import type { EventFile, EventVideo } from './uploads';
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
  status?: 'draft' | 'published' | 'cancelled';
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
  /** The Event's files and videos, in its detail only; lists carry the counts alone. */
  files?: EventFile[];
  videos?: EventVideo[];
  fileCount?: number;
  videoCount?: number;
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
  ranked: boolean;
  prizeInfo?: string;
  coverImageId?: string;
  attendanceRule?: string;
  attendanceRatio?: number;
  doorStaffIds?: string[];
};

/**
 * A partial update (PUT and PATCH alike in core, ADR 0066 addendum): a key
 * left out keeps its value; `null` (or `""`, `[]`) clears a field that may be
 * empty. `name`, `location` and `ownerTeam` cannot be cleared, `ranked`
 * takes no `null`.
 */
export type EventPatch = {
  name?: string;
  description?: string;
  location?: string;
  ownerTeam?: string;
  formUrl?: string | null;
  formAlias?: string | null;
  extraFormUrls?: { label: string; url: string; alias?: string }[] | null;
  capacity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  linkedin?: string | null;
  ranked?: boolean;
  prizeInfo?: string | null;
  coverImageId?: string | null;
  attendanceRule?: string | null;
  attendanceRatio?: number | null;
  doorStaffIds?: string[] | null;
};

export const eventsApi = {
  /**
   * The current Events, or with `lifecycle` the archived (`inactive`) ones
   * or both (`all`); core returns only the archived Events the caller may
   * delete.
   */
  list: (ownerTeam?: string, lifecycle?: 'inactive' | 'all') => {
    const query = new URLSearchParams();
    if (ownerTeam) query.set('ownerTeam', ownerTeam);
    if (lifecycle) query.set('lifecycle', lifecycle);
    const q = query.toString();
    return coreFetch<CoreEvent[]>(`/v1/events${q ? `?${q}` : ''}`);
  },
  get: (id: string) => coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`),
  create: (body: EventBody) =>
    coreFetch<CoreEvent>('/v1/events', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) =>
    coreFetch<void>(`/v1/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** Writes only the fields sent; core keeps every other one. */
  patch: (id: string, body: EventPatch) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Brings back an Event its delete archived (Geri al). */
  restore: (id: string) =>
    coreFetch<CoreEvent>(`/v1/events/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
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
  syncMailList: (id: string, ticketIds?: string[]) =>
    coreFetch<EventMailList>(`/v1/events/${encodeURIComponent(id)}/mail-list`, {
      method: 'POST',
      body: ticketIds ? JSON.stringify({ ticketIds }) : undefined,
    }),
};

export type EventMailList = {
  mailListId: string;
  name: string;
  recipientCount: number;
};
