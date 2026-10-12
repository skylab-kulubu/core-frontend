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
  /** The role of the same name, as the object of a Turkish sentence. */
  roleName?: string;
};

/** Everything superadmin knows about each purpose, in catalogue order. */
export const MEDIA_PURPOSES: Record<MediaPurpose, MediaPurposeInfo> = {
  profile_picture: { label: 'Profil fotoğrafı' },
  event_cover: { label: 'Etkinlik kapağı', roleName: 'etkinlik kapağı' },
  event_gallery: { label: 'Etkinlik galerisi', roleName: 'etkinlik galerisi görseli' },
  certificate_asset: { label: 'Sertifika şablon görseli', roleName: 'sertifika şablon görseli' },
  cms_image: { label: 'CMS görseli' },
  cms_file: { label: 'CMS dosyası' },
  answer_file: { label: 'Yanıt dosyası' },
  club_file: { label: 'Kulüp dosyası' },
  answer_file_large: { label: 'Büyük yanıt dosyası' },
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

/** A role core named in a link refusal, as the object of a Turkish sentence. */
export function mediaRoleName(role?: string | null): string | undefined {
  return purposeInfo(role)?.roleName;
}
