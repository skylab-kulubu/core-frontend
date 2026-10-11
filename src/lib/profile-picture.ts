import { publicMediaUrl } from '@/lib/event-media';

type ImageSize = { url: string; width?: number; height?: number };

/** What core answers for a person's picture where it shows one (see core-backend docs/media-lifecycle.md). */
export type ProfilePicture = {
  profilePictureUrl?: string | null;
  profilePictureSizes?: { card?: ImageSize; page?: ImageSize } | null;
};

/** The address an avatar loads: the small `card` size when core has made one, else the full picture. */
export function profilePictureSrc(person: ProfilePicture | null | undefined): string | undefined {
  const raw = person?.profilePictureSizes?.card?.url || person?.profilePictureUrl || '';
  return publicMediaUrl(raw) || undefined;
}
