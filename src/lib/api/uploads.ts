import { coreFetch } from './core';
import type { CoreEvent } from './events';
import type { Media } from './media';

/** The purposes an Event takes through direct upload (core media lifecycle, "Direct upload"). */
export type DirectUploadPurpose = 'video' | 'club_file';

export type UploadPart = { partNumber: number; size: number; url: string };
export type UploadedPart = { partNumber: number; size: number; etag: string };

/** An open direct upload: where each part goes and which parts R2 already holds. */
export type UploadSession = {
  id: string;
  purpose: DirectUploadPurpose;
  name: string;
  size: number;
  partSize: number;
  partCount: number;
  expiresAt: string;
  uploaded: UploadedPart[];
  parts: UploadPart[];
  partUrlsExpireAt: string;
};

export const uploadsApi = {
  start: (body: { purpose: DirectUploadPurpose; name: string; size: number }) =>
    coreFetch<UploadSession>('/v1/uploads', { method: 'POST', body: JSON.stringify(body) }),
  /** What R2 holds whole, and new addresses for the other parts. */
  parts: (id: string) =>
    coreFetch<UploadSession>(`/v1/uploads/${encodeURIComponent(id)}/parts`, { method: 'POST' }),
  complete: (id: string, parts: { partNumber: number; etag: string }[]) =>
    coreFetch<Media>(`/v1/uploads/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ parts }),
    }),
};

/** Why core refused a club file after its malware scan. */
export type ScanResult =
  | 'infected'
  | 'too_large_to_scan'
  | 'archive_invalid'
  | 'archive_nested'
  | 'lost'
  | 'integrity'
  | 'scan_timeout';

export type EventFileStatus = 'attached' | 'scanning' | 'rejected' | 'pending';

/** One of an Event's files or videos, as its detail lists them. */
export type EventFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  status: EventFileStatus;
  /** Only while it can be served; it changes once for a video, so read it from the Event each time. */
  url?: string;
  scanResult?: ScanResult | string;
};

export type PosterSize = { url: string; width?: number; height?: number };

export type EventVideo = EventFile & {
  poster?: {
    id: string;
    type: string;
    url: string;
    sizes: { card: PosterSize; page: PosterSize };
    /** `uploaded` when an organizer chose it, `frame` when core took it from the video. */
    source: 'uploaded' | 'frame';
  };
};

export type EventMediaKind = 'files' | 'videos';

const base = (eventId: string, kind: EventMediaKind) =>
  `/v1/events/${encodeURIComponent(eventId)}/${kind}`;

/** An Event's files and videos lists and its videos' posters; every call answers the Event's detail. */
export const eventMediaApi = {
  add: (eventId: string, kind: EventMediaKind, ids: string[]) =>
    coreFetch<CoreEvent>(base(eventId, kind), { method: 'POST', body: JSON.stringify(ids) }),
  remove: (eventId: string, kind: EventMediaKind, ids: string[]) =>
    coreFetch<CoreEvent>(base(eventId, kind), { method: 'DELETE', body: JSON.stringify(ids) }),
  order: (eventId: string, kind: EventMediaKind, ids: string[]) =>
    coreFetch<CoreEvent>(`${base(eventId, kind)}/order`, {
      method: 'PUT',
      body: JSON.stringify(ids),
    }),
  setPoster: (eventId: string, videoId: string, posterId: string) =>
    coreFetch<CoreEvent>(`${base(eventId, 'videos')}/${encodeURIComponent(videoId)}/poster`, {
      method: 'PUT',
      body: JSON.stringify({ posterId }),
    }),
  clearPoster: (eventId: string, videoId: string) =>
    coreFetch<CoreEvent>(`${base(eventId, 'videos')}/${encodeURIComponent(videoId)}/poster`, {
      method: 'DELETE',
    }),
};
