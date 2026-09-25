import { coreFetch } from './core';
import type { MediaPurpose, MediaStatus } from '@/lib/media-purposes';

export type Media = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedBy: string;
  kind: string;
  /** The Media purpose it was uploaded for (ADR-0052); `legacy` without one. */
  purpose?: MediaPurpose;
  /** Whether a record uses it: `pending`, `attached` or `detached` (core media redesign ticket 02). */
  status?: MediaStatus;
  /** When a pending or detached Media is purged unless something links it. */
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export const mediaApi = {
  list: () => coreFetch<Media[]>('/v1/media'),
  get: (id: string) => coreFetch<Media>(`/v1/media/${encodeURIComponent(id)}`),
  upload: (file: File, purpose?: MediaPurpose) => {
    const body = new FormData();
    if (purpose) body.append('purpose', purpose);
    body.append('file', file);
    return coreFetch<Media>('/v1/media', { method: 'POST', body });
  },
  remove: (id: string) =>
    coreFetch<void>(`/v1/media/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
