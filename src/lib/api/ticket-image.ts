import { coreFetch } from './core';

/** Where the PDF ticket's band takes its picture (core docs/ticket-image.md). */
export type TicketImageSource = 'auto' | 'cover' | 'upload';

/** A region of an image, in fractions of its width (x, w) and height (y, h). */
export type TicketImageCrop = { x: number; y: number; w: number; h: number };

export type TicketImage = {
  source: TicketImageSource;
  mediaId?: string;
  mediaUrl?: string;
  coverMediaId?: string;
  crop?: TicketImageCrop;
  /** A cover region drawn on another cover: the band shows the new cover's middle. */
  coverChanged: boolean;
  updatedAt?: string;
  band: { widthMm: number; heightMm: number };
};

export type TicketImageBody = {
  source: TicketImageSource;
  mediaId?: string;
  coverMediaId?: string;
  crop?: TicketImageCrop;
};

const path = (eventId: string) => `/v1/events/${encodeURIComponent(eventId)}/ticket-image`;

export const ticketImageApi = {
  get: (eventId: string) => coreFetch<TicketImage>(path(eventId)),
  save: (eventId: string, body: TicketImageBody) =>
    coreFetch<TicketImage>(path(eventId), { method: 'PUT', body: JSON.stringify(body) }),
};
