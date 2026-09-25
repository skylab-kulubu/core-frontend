import type { StatusChipKind } from '@/lib/status-chip';

/**
 * A Media purpose, as core's catalogue names it (ADR-0052, core-backend
 * `config/media-purposes.json`). `legacy` is core's own: Media uploaded
 * without a purpose, and every Media stored before purposes existed.
 */
export type MediaPurpose =
  | 'profile_picture'
  | 'event_cover'
  | 'event_gallery'
  | 'certificate_asset'
  | 'cms_image'
  | 'cms_file'
  | 'answer_file'
  | 'club_file'
  | 'answer_file_large'
  | 'video'
  | 'legacy';

/** The roles superadmin links a Media under; core names each after the purpose it takes. */
export type MediaRole = 'event_cover' | 'event_gallery' | 'certificate_asset';

/** Whether a record uses a Media, as core's Media JSON says (media redesign ticket 02). */
export type MediaStatus = 'pending' | 'attached' | 'detached';

type MediaPurposeInfo = {
  /** The Turkish label superadmin shows for the purpose. */
  label: string;
  /** Never a public address; nobody browses it from the Media screen. */
  private?: true;
  /** The role of the same name, as the object of a Turkish sentence. */
  roleName?: string;
};

/** Everything superadmin knows about each purpose, in catalogue order. */
export const MEDIA_PURPOSES: Record<MediaPurpose, MediaPurposeInfo> = {
  profile_picture: { label: 'Profil fotoğrafı' },
  event_cover: { label: 'Etkinlik kapağı', roleName: 'etkinlik kapağı' },
  event_gallery: { label: 'Etkinlik galerisi', roleName: 'etkinlik galerisi görseli' },
  certificate_asset: {
    label: 'Sertifika şablon görseli',
    private: true,
    roleName: 'sertifika şablon görseli',
  },
  cms_image: { label: 'CMS görseli' },
  cms_file: { label: 'CMS dosyası' },
  answer_file: { label: 'Yanıt dosyası', private: true },
  club_file: { label: 'Kulüp dosyası' },
  answer_file_large: { label: 'Büyük yanıt dosyası', private: true },
  video: { label: 'Video' },
  legacy: { label: 'Eski kayıt (legacy)' },
};

function purposeInfo(purpose?: string | null): MediaPurposeInfo | undefined {
  const value = (purpose ?? '').trim();
  return Object.hasOwn(MEDIA_PURPOSES, value) ? MEDIA_PURPOSES[value as MediaPurpose] : undefined;
}

/** The Turkish label of a purpose; a purpose superadmin does not know yet shows as core names it. */
export function mediaPurposeLabel(purpose?: string | null): string {
  return purposeInfo(purpose)?.label ?? (purpose ?? '').trim();
}

export function isPrivateMediaPurpose(purpose?: string | null): boolean {
  return Boolean(purposeInfo(purpose)?.private);
}

/** A role core named in a link refusal, as the object of a Turkish sentence. */
export function mediaRoleName(role?: string | null): string | undefined {
  return purposeInfo(role)?.roleName;
}

/** The distinct purposes given, in catalogue order; purposes superadmin does not know yet go last. */
export function orderedMediaPurposes(purposes: ReadonlyArray<string | undefined>): string[] {
  const catalogue: string[] = Object.keys(MEDIA_PURPOSES);
  const rank = (purpose: string) => {
    const index = catalogue.indexOf(purpose);
    return index === -1 ? catalogue.length : index;
  };
  const distinct = [...new Set(purposes.filter((purpose): purpose is string => Boolean(purpose)))];
  return distinct.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The Turkish label and chip of each Media status. */
export const MEDIA_STATUSES: Record<MediaStatus, { label: string; chip: StatusChipKind }> = {
  pending: { label: 'Beklemede', chip: 'pending' },
  attached: { label: 'Bağlı', chip: 'active' },
  detached: { label: 'Ayrıldı', chip: 'passive' },
};

const EXPIRY_FORMAT = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

/**
 * How the Media screen shows where a Media is in its lifecycle: its status
 * chip, and when it is purged unless a record links it. A pending Media with
 * no expiry (legacy, kept until ticket 08 reports it) gets neither: nothing
 * is waiting to happen to it.
 */
export function mediaLifecycleView(media: { status?: MediaStatus; expiresAt?: string }): {
  status?: { label: string; chip: StatusChipKind };
  expiry?: string;
} {
  if (!media.status || !Object.hasOwn(MEDIA_STATUSES, media.status)) return {};
  const expiresAt = media.expiresAt ? new Date(media.expiresAt) : null;
  const expires = expiresAt && !Number.isNaN(expiresAt.getTime());
  if (media.status === 'pending' && !expires) return {};
  return {
    status: MEDIA_STATUSES[media.status],
    expiry: expires ? `Bağlanmazsa silinir: ${EXPIRY_FORMAT.format(expiresAt)}` : undefined,
  };
}
