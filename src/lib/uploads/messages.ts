import type { ScanResult } from '@/lib/api/uploads';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

export function formatBytes(bytes: number): string {
  const format = (value: number, unit: string) =>
    `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${unit}`;
  if (bytes >= GIB) return format(bytes / GIB, 'GB');
  if (bytes >= MIB) return format(bytes / MIB, 'MB');
  if (bytes >= 1024) return format(bytes / 1024, 'KB');
  return `${bytes} B`;
}

function wait(seconds: unknown): string {
  const s = typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds) : 0;
  if (!s) return 'biraz';
  if (s < 90) return `${s} saniye`;
  if (s < 5400) return `${Math.ceil(s / 60)} dakika`;
  return `${Math.ceil(s / 3600)} saat`;
}

/**
 * What to tell the organizer for core's problem code (core media lifecycle,
 * "Refusals"); core's own detail is never shown.
 */
export function uploadErrorMessage(
  code: string | undefined,
  fields: Record<string, unknown> = {},
): string {
  switch (code) {
    case 'purpose_not_available':
    case 'direct_upload_unavailable':
      return 'Şu an kullanılamıyor.';
    case 'media_too_large':
      return typeof fields.maxBytes === 'number'
        ? `Dosya çok büyük (en çok ${formatBytes(fields.maxBytes)}).`
        : 'Dosya çok büyük.';
    case 'media_type_not_allowed': {
      const types = Array.isArray(fields.allowedTypes) ? fields.allowedTypes.join(' ') : '';
      return types.includes('video/mp4')
        ? 'Yalnız MP4 yüklenebilir.'
        : 'Yalnız PDF ya da ZIP yüklenebilir.';
    }
    case 'upload_size_mismatch':
      return 'Yükleme bozuldu, baştan başlat.';
    case 'upload_gone':
      return 'Yükleme bulunamadı ya da süresi doldu, baştan başlat.';
    case 'media_rate_limited':
      return fields.limit === 'open'
        ? `Aynı anda en çok 3 yükleme açık olabilir; ${wait(fields.retryAfterSeconds)} sonra tekrar dene.`
        : `Bugünlük yükleme hacmi doldu; ${wait(fields.retryAfterSeconds)} sonra tekrar dene.`;
    case 'media_purpose_mismatch':
      return 'Bu dosya buraya eklenemez.';
    case 'media_not_linkable':
      return 'Dosya artık kullanılamıyor, yeniden yükle.';
    case 'media_team_mismatch':
      return 'Bu dosya başka bir ekibe ait.';
    case 'part_failed':
      return 'Dosyanın bir kısmı gönderilemedi. Bağlantını kontrol edip aynı dosyayı yeniden seç; kaldığı yerden devam eder.';
    default:
      return 'Yükleme tamamlanamadı. Lütfen yeniden dene.';
  }
}

/** Why a club file was rejected after its scan, and what to do about it. */
export function scanResultMessage(result: ScanResult | string | undefined): string {
  switch (result) {
    case 'infected':
      return 'Dosyada zararlı içerik bulundu ve silindi. Temiz bir kopyasını yükleyin.';
    case 'too_large_to_scan':
      return 'Dosya bütünüyle taranamadı. Daha sade bir kopya ya da PDF yükleyin.';
    case 'archive_invalid':
      return 'Dosya bozuk ya da şifreli. Şifresiz, sağlam bir kopya yükleyin.';
    case 'archive_nested':
      return 'İçteki arşivleri açıp tekrar yükleyin.';
    case 'scan_timeout':
      return 'Tarama tamamlanamadı. Lütfen yeniden yükleyin.';
    default:
      return 'Dosya işlenemedi. Lütfen yeniden yükleyin.';
  }
}
