import { ProblemError } from '@/lib/api/core';
import { mediaPurposeLabel, mediaRoleName } from '@/lib/media-purposes';
import { rolePlacementMessage } from '@/lib/role-placement';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

function formatBytes(bytes: number): string {
  if (bytes >= GIB) return `${oneDecimal(bytes / GIB)} GB`;
  return `${oneDecimal(bytes / MIB)} MB`;
}

/** Short names for the types the purposes superadmin uploads accept. */
const TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
};

function typeNames(value: unknown): string {
  const types = Array.isArray(value) ? value.filter((row) => typeof row === 'string') : [];
  return types.map((type) => TYPE_NAMES[type] ?? type).join(', ');
}

/** A wait in Turkish, rounded up: `45 saniye`, `4 dakika`, `1 saat 30 dakika`. */
function formatWait(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds));
  if (total < 60) return `${total} saniye`;
  const minutes = Math.ceil(total / 60);
  if (minutes < 60) return `${minutes} dakika`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} saat ${rest} dakika` : `${hours} saat`;
}

const LOCATIVE: Record<string, string> = { saniye: 'saniyede', dakika: 'dakikada', saat: 'saatte' };

function within(seconds: number): string {
  const words = formatWait(seconds).split(' ');
  const last = words.pop() ?? '';
  return [...words, LOCATIVE[last] ?? last].join(' ');
}

/**
 * The most core takes in one request (its single-step upload ceiling); above
 * it the HTTP server refuses the body with a bare 413, or drops the
 * connection, before any purpose is read.
 */
export const SINGLE_STEP_MAX_BYTES = 20 * MIB;

/**
 * Whether core refused an upload for the file itself (too large, wrong type),
 * so the next file of a batch may still fit. Any 413 counts, with or without
 * a code.
 */
export function isPerFileRefusal(error: unknown): boolean {
  if (!(error instanceof ProblemError)) return false;
  return error.status === 413 || error.code === 'media_type_not_allowed';
}

/** How long core asked to wait before the next upload, from a `media_rate_limited` refusal. */
export function uploadRetryAfterSeconds(error: unknown): number | undefined {
  if (!(error instanceof ProblemError) || error.code !== 'media_rate_limited') return undefined;
  const seconds = Number(error.fields.retryAfterSeconds);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function purposeOf(error: ProblemError): string {
  return mediaPurposeLabel(text(error.fields.purpose)) || 'bu alan';
}

/** Turkish sentences for core codes the panel meets outside media. */
const CODE_MESSAGES: Record<string, string> = {
  session_closed: 'Bu oturum şu an girişe açık değil.',
  event_managed: 'Bu kısa link bir etkinliğe ait; etkinliğin sayfasından değiştir.',
  managed: 'Bu kısa link sistem tarafından yönetiliyor; buradan değiştirilemez.',
  // Event status (ADR 0066): certificates, competitors and event writes refuse with these
  event_not_published: 'Etkinlik henüz yayımlanmadı.',
  event_cancelled: 'Etkinlik iptal edilmiş.',
  ytu_managed_field: 'Bu alan YTÜ hesabından geliyor; buradan değiştirilemez.',
  // Group name refusals (core teamcode)
  invalid_name:
    'Grup adı 2-24 karakter olmalı: büyük harfle başlar, yalnız büyük harf (A-Z), rakam ve tire içerir (ör. WEBLAB, AI-LAB).',
  reserved_name: 'Bu grup adı ayrılmış; başka bir ad seç.',
  name_taken: 'Bu ad başka bir grupta ya da kayıtta kullanılıyor; başka bir ad seç.',
  privileged_root: 'Bu grubun adı değiştirilemez: üyelerinin yönetim yetkisi değişirdi.',
  // Role rules (core rol-temizligi 06): access comes through Groups only
  direct_role_not_allowed:
    'Kişiye doğrudan rol verilmez; kişiyi rolü taşıyan gruba ekle (/ROLLER altındaki rol grubu, ekibin lider grubu ya da yönetim kökü).',
  keycloak_admin_role:
    'Bu rol Keycloak yönetim yetkisi taşıyor; panelden verilmez, yalnız Keycloak konsolundan verilir.',
  keycloak_admin_group:
    'Bu grup (ya da üstündeki bir grup) Keycloak yönetim yetkisi taşıyor; üyeliği yalnız Keycloak konsolundan değişir.',
};

/** The sentence for a Group created under a role group (core roleGroupStaysLeaf). */
export const ROLE_GROUP_STAYS_LEAF =
  'Rol grubunun altına grup açılmaz; /ROLLER altındaki rol grupları tek katmandır.';

/** What a rename that moves the Group's roles to a refused place is told before the reason. */
export const RENAME_PLACEMENT_PREFIX =
  'Yeni adla bu gruptaki roller kurala aykırı bir yere düşerdi: ';

/**
 * A Turkish sentence for a failed Group create or save. core's
 * `role_placement` means something else on these writes than on a role
 * mapping: on a create, the new Group would sit under a role group; on a
 * rename, the Group's own roles would land where the rule allows none.
 * Every other refusal reads as coreProblemMessage.
 */
export function groupWriteProblemMessage(
  error: unknown,
  write: 'create' | 'save',
  fallback: string,
): string {
  if (error instanceof ProblemError && error.code === 'role_placement') {
    if (write === 'create' && error.fields.reason === 'roles_group_not_leaf') {
      return ROLE_GROUP_STAYS_LEAF;
    }
    if (write === 'save')
      return RENAME_PLACEMENT_PREFIX + rolePlacementMessage(error.fields.reason);
  }
  return coreProblemMessage(error, fallback);
}

/** Deleting a Group has stricter safeguards than renaming or changing membership. */
export function groupDeleteProblemMessage(error: unknown): string {
  if (error instanceof ProblemError) {
    const messages: Record<string, string> = {
      not_empty: 'Önce grubun üyelerini ve alt gruplarını taşı veya çıkar.',
      code_in_use: 'Bu gruba bağlı kayıtlar var; grup silinemez.',
      group_delete_protected: 'Bu sistem veya rol grubu buradan silinemez.',
      privileged_root: 'Yönetim grupları ve bunların üst veya alt grupları buradan silinemez.',
      protected_group: 'Bu grup veya üst grubu korunan roller taşıyor; buradan silinemez.',
      protection_unverified: 'Grubun rol koruması doğrulanamadı; daha sonra tekrar dene.',
      group_tree_mismatch: 'Grup ağacı doğrulanamadı; yöneticiye haber ver.',
    };
    if (error.code && messages[error.code]) return messages[error.code];
  }
  return coreProblemMessage(error, 'Grup silinemedi');
}

/**
 * core's bare 409 on a competitor's create or save. It has no code and means
 * one of several things (the person already competes, their account is not
 * active, the event is archived), so the text names what to check.
 */
export const COMPETITOR_CONFLICT = {
  409: 'Yarışmacı kaydedilemedi; kişiyi ve etkinliğin durumunu denetle.',
};

/** core's own English titles that carry meaning but no code. */
const TITLE_MESSAGES: Record<string, string> = {
  'Ambiguous Match': 'Bu adla birden fazla kayıt var; e-posta ile dene.',
  'No mail recipients': 'Mail gönderilecek alıcı yok.',
  'Skymail is not configured': 'Mail gönderimi şu an kullanılamıyor; yöneticiye haber ver.',
};

const SERVER_FAILED = 'Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.';

/** What a status means for the person in the panel, when core says no more than the status. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'İstek geçersiz. Girdiklerini denetleyip tekrar dene.',
  401: 'Oturumun sona ermiş. Sayfayı yenileyip yeniden giriş yap.',
  403: 'Bu işlem için yetkin yok.',
  404: 'Kayıt bulunamadı; silinmiş olabilir.',
  409: 'Kayıt şu anki durumunda buna uygun değil ya da aynı bilgilerle başka bir kayıt var.',
  410: 'Kayıt artık yok.',
  422: 'Gönderilen bilgiler geçersiz. Alanları denetleyip tekrar dene.',
  429: 'Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.',
};

/** Whether `fetch` itself failed (offline, DNS, CORS): browsers throw a TypeError with these words. */
function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)
  );
}

/**
 * A Turkish sentence for a failed core call, for every place the panel shows
 * one: a known code (media refusals, door, short links) in its own words;
 * otherwise the status in Turkish (`statusText` lets a caller word one for its
 * own action). core's title and detail are English and never shown: a refusal
 * without a Turkish sentence of its own gets the status's or the caller's
 * general text. A network failure says the server could not be reached;
 * anything else is the caller's `fallback`.
 */
export function coreProblemMessage(
  error: unknown,
  fallback = 'Yüklenemedi',
  statusText: Partial<Record<number, string>> = {},
): string {
  if (!(error instanceof ProblemError)) {
    return isNetworkFailure(error)
      ? 'Sunucuya ulaşılamadı. Bağlantını denetleyip tekrar dene.'
      : fallback;
  }
  const fields = error.fields;
  switch (error.code) {
    case 'purpose_unknown':
      return `Sunucu bu yükleme amacını tanımıyor (${text(fields.purpose)}). Sayfayı yenileyip tekrar dene; sürerse yöneticiye haber ver.`;
    case 'purpose_forbidden':
      return `${purposeOf(error)} yüklemeye yetkin yok.`;
    case 'private_media_disabled':
      return `${purposeOf(error)} gizli bir dosya türü ve gizli dosya depolama henüz açılmadı; şimdilik yüklenemez.`;
    case 'purpose_requires_direct_upload':
      return `${purposeOf(error)} büyük dosya yüklemesiyle gönderilir; buradan yüklenemez.`;
    case 'media_too_large': {
      const maxBytes = Number(fields.maxBytes);
      return `Dosya çok büyük: ${purposeOf(error)} için en fazla ${formatBytes(maxBytes)} yüklenebilir.`;
    }
    case 'media_type_not_allowed': {
      const allowed = typeNames(fields.allowedTypes);
      const sentence = `Bu dosya türü ${purposeOf(error)} için kabul edilmiyor.`;
      return allowed ? `${sentence} Kabul edilenler: ${allowed}.` : sentence;
    }
    case 'media_rate_limited': {
      const limit =
        fields.limit === 'volume'
          ? `günde en fazla ${formatBytes(Number(fields.maxDailyBytes))}`
          : `${within(Number(fields.uploadWindowSeconds))} en fazla ${Number(fields.maxUploads)} dosya`;
      const seconds = uploadRetryAfterSeconds(error);
      const wait =
        seconds === undefined
          ? 'Biraz sonra tekrar dene.'
          : `${formatWait(seconds)} sonra tekrar dene.`;
      return `Yükleme sınırına ulaştın: ${limit}. ${wait}`;
    }
    case 'media_purpose_mismatch': {
      const role = mediaRoleName(text(fields.role));
      const where = role ? `${role} olarak` : 'burada';
      return `Bu dosya ${purposeOf(error)} için yüklenmiş; ${where} kullanılamaz. Dosyayı bu alan için yeniden yükle.`;
    }
    case 'media_not_linkable':
      return 'Seçilen dosya artık kullanılamıyor: silinmiş, arşivlenmiş ya da kaydedilmeden süresi dolmuş. Dosyayı yeniden yükle.';
    case 'role_placement':
      return rolePlacementMessage(fields.reason);
    case 'media_team_mismatch':
      return 'Bu fotoğraf başka bir ekibin etkinliğinde kullanılıyor. Yalnız kendi ekibinin fotoğraflarını kullanabilirsin.';
    default:
      if (error.status === 413) {
        return `Dosya çok büyük: sunucu tek seferde en fazla ${formatBytes(SINGLE_STEP_MAX_BYTES)} kabul ediyor.`;
      }
      if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
      if (TITLE_MESSAGES[error.title]) return TITLE_MESSAGES[error.title];
      return (
        statusText[error.status] ??
        STATUS_MESSAGES[error.status] ??
        (error.status >= 500 ? SERVER_FAILED : fallback)
      );
  }
}
