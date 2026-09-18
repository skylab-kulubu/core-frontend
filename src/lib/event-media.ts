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
        url: ref.url,
        eventName,
      });
    }
  }
  return photos;
}
