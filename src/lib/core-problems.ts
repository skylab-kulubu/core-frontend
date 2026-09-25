import { ProblemError } from '@/lib/api/core';
import { mediaPurposeLabel, mediaRoleName } from '@/lib/media-purposes';

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

/**
 * A Turkish sentence for a problem core answered with: the media refusals
 * (upload purpose, upload limit, links on save) by their code, anything else
 * by its detail, then its title.
 */
export function coreProblemMessage(error: unknown, fallback = 'Yüklenemedi'): string {
  if (!(error instanceof ProblemError)) return fallback;
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
    case 'media_team_mismatch':
      return 'Bu fotoğraf başka bir ekibin etkinliğinde kullanılıyor. Yalnız kendi ekibinin fotoğraflarını kullanabilirsin.';
    default:
      if (error.status === 413) {
        return `Dosya çok büyük: sunucu tek seferde en fazla ${formatBytes(SINGLE_STEP_MAX_BYTES)} kabul ediyor.`;
      }
      return error.detail || error.title || fallback;
  }
}
