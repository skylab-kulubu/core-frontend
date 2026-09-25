export const DEFAULT_CDN_ORIGIN = 'https://cdn.yildizskylab.com';

export function cdnOrigin(env = process.env.NEXT_PUBLIC_CDN_URL): string {
  const trimmed = (env ?? '').trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_CDN_ORIGIN;
}

export function publicMediaUrl(raw?: string | null, base = cdnOrigin()): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (/^(?:blob|data):/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('//')) return value;
  const origin = (base || DEFAULT_CDN_ORIGIN).replace(/\/+$/, '');
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

export type EventPhotoRef = {
  id: string;
  url?: string;
  name?: string;
};

export type EventMediaHint = EventPhotoRef;

export type EventWithPhotos = {
  id?: string;
  name?: string;
  ownerTeam?: string;
  coverImageId?: string;
  coverImageUrl?: string;
  images?: { id: string; url?: string }[];
};

export type TeamPhoto = {
  id: string;
  title: string;
  url?: string;
  eventName: string;
};

export function teamEventPhotos(events: EventWithPhotos[], ownerTeam: string): TeamPhoto[] {
  const team = ownerTeam.trim();
  if (!team) return [];
  const seen = new Set<string>();
  const photos: TeamPhoto[] = [];
  for (const event of events) {
    if ((event.ownerTeam ?? '').trim() !== team) continue;
    const eventName = event.name?.trim() || 'Etkinlik';
    const refs: EventPhotoRef[] = [];
    if (event.coverImageId) {
      refs.push({ id: event.coverImageId, url: event.coverImageUrl, name: 'Kapak' });
    }
    for (const image of event.images ?? []) {
      refs.push({ id: image.id, url: image.url, name: 'Galeri' });
    }
    for (const ref of refs) {
      if (!ref.id || seen.has(ref.id)) continue;
      seen.add(ref.id);
      photos.push({
        id: ref.id,
        title: ref.name || ref.id,
        url: publicMediaUrl(ref.url) || undefined,
        eventName,
      });
    }
  }
  return photos;
}

/**
 * The Owner teams whose Events use each Media, as cover or gallery photo,
 * keyed by Media id. Core's Media list does not carry an Owner team, so the
 * Media screen reads it from the Events.
 */
export function mediaOwnerTeams(events: EventWithPhotos[]): Record<string, string[]> {
  const teams: Record<string, string[]> = {};
  for (const event of events) {
    const team = (event.ownerTeam ?? '').trim();
    if (!team) continue;
    const ids = [event.coverImageId, ...(event.images ?? []).map((image) => image.id)];
    for (const id of ids) {
      if (!id) continue;
      const known = (teams[id] ??= []);
      if (!known.includes(team)) known.push(team);
    }
  }
  return teams;
}
