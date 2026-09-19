import { coreFetch } from './core';

export type Media = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedBy: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
};

export const mediaApi = {
  list: () => coreFetch<Media[]>('/v1/media'),
  get: (id: string) => coreFetch<Media>(`/v1/media/${encodeURIComponent(id)}`),
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return coreFetch<Media>('/v1/media', { method: 'POST', body });
  },
  remove: (id: string) =>
    coreFetch<void>(`/v1/media/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
