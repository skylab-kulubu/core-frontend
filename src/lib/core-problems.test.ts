import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage, isPerFileRefusal } from '@/lib/core-problems';

function problem(status: number, code: string, fields: Record<string, unknown> = {}) {
  return new ProblemError(status, 'Core title', { code, detail: 'Core detail.', fields });
}

describe('coreProblemMessage', () => {
  it('names the purpose limit when the file is too large', () => {
    expect(
      coreProblemMessage(
        problem(413, 'media_too_large', { purpose: 'event_gallery', maxBytes: 10485760 }),
      ),
    ).toBe('Dosya çok büyük: Etkinlik galerisi için en fazla 10 MB yüklenebilir.');
  });

  it('lists the types the purpose accepts when the content is another type', () => {
    expect(
      coreProblemMessage(
        problem(415, 'media_type_not_allowed', {
          purpose: 'event_cover',
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        }),
      ),
    ).toBe(
      'Bu dosya türü Etkinlik kapağı için kabul edilmiyor. Kabul edilenler: JPEG, PNG, WebP, GIF.',
    );
  });

  it.each([
    [
      400,
      'purpose_unknown',
      'club_poster',
      'Sunucu bu yükleme amacını tanımıyor (club_poster). Sayfayı yenileyip tekrar dene; sürerse yöneticiye haber ver.',
    ],
    [403, 'purpose_forbidden', 'event_cover', 'Etkinlik kapağı yüklemeye yetkin yok.'],
    [
      422,
      'private_media_disabled',
      'certificate_asset',
      'Sertifika şablon görseli gizli bir dosya türü ve gizli dosya depolama henüz açılmadı; şimdilik yüklenemez.',
    ],
    [
      400,
      'purpose_requires_direct_upload',
      'video',
      'Video büyük dosya yüklemesiyle gönderilir; buradan yüklenemez.',
    ],
  ])('explains %i %s', (status, code, purpose, message) => {
    expect(coreProblemMessage(problem(status, code, { purpose }))).toBe(message);
  });

  describe('linking a Media on save', () => {
    it('says a Media uploaded for another purpose cannot take this role', () => {
      expect(
        coreProblemMessage(
          problem(422, 'media_purpose_mismatch', {
            mediaId: 'm1',
            role: 'event_cover',
            purpose: 'event_gallery',
          }),
        ),
      ).toBe(
        'Bu dosya Etkinlik galerisi için yüklenmiş; etkinlik kapağı olarak kullanılamaz. Dosyayı bu alan için yeniden yükle.',
      );
    });

    it('says a Media that is gone must be uploaded again', () => {
      expect(
        coreProblemMessage(
          problem(422, 'media_not_linkable', { mediaId: 'm1', role: 'event_gallery' }),
        ),
      ).toBe(
        'Seçilen dosya artık kullanılamıyor: silinmiş, arşivlenmiş ya da kaydedilmeden süresi dolmuş. Dosyayı yeniden yükle.',
      );
    });

    it('refuses another Owner team photo', () => {
      expect(
        coreProblemMessage(
          problem(403, 'media_team_mismatch', { mediaId: 'm1', role: 'event_cover' }),
        ),
      ).toBe(
        'Bu fotoğraf başka bir ekibin etkinliğinde kullanılıyor. Yalnız kendi ekibinin fotoğraflarını kullanabilirsin.',
      );
    });
  });

  describe('upload limit', () => {
    const budget = { maxUploads: 100, uploadWindowSeconds: 600, maxDailyBytes: 2147483648 };

    it('says which limit was hit and how long to wait', () => {
      expect(
        coreProblemMessage(
          problem(429, 'media_rate_limited', {
            ...budget,
            limit: 'uploads',
            retryAfterSeconds: 240,
          }),
        ),
      ).toBe(
        'Yükleme sınırına ulaştın: 10 dakikada en fazla 100 dosya. 4 dakika sonra tekrar dene.',
      );
      expect(
        coreProblemMessage(
          problem(429, 'media_rate_limited', {
            ...budget,
            limit: 'volume',
            retryAfterSeconds: 5400,
          }),
        ),
      ).toBe('Yükleme sınırına ulaştın: günde en fazla 2 GB. 1 saat 30 dakika sonra tekrar dene.');
    });

    it.each([
      [45, '45 saniye'],
      [61, '2 dakika'],
      [3600, '1 saat'],
    ])('rounds a %i second wait up to %s', (seconds, wait) => {
      expect(
        coreProblemMessage(
          problem(429, 'media_rate_limited', {
            ...budget,
            limit: 'uploads',
            retryAfterSeconds: seconds,
          }),
        ),
      ).toContain(`${wait} sonra tekrar dene.`);
    });
  });
});

describe('coreProblemMessage without a known code', () => {
  it("falls back to core's detail", () => {
    expect(
      coreProblemMessage(
        new ProblemError(400, 'Bad Request', {
          code: 'media_new_rule',
          detail: 'A new rule refused it.',
        }),
      ),
    ).toBe('A new rule refused it.');
  });

  it('falls back to the title, then to the caller text', () => {
    expect(coreProblemMessage(new ProblemError(500, 'Internal Server Error'))).toBe(
      'Internal Server Error',
    );
    expect(coreProblemMessage(new TypeError('Failed to fetch'), 'Galeri yüklenemedi')).toBe(
      'Galeri yüklenemedi',
    );
  });
});

describe('isPerFileRefusal', () => {
  it('is true for a refusal about the file itself, with or without a code', () => {
    expect(isPerFileRefusal(problem(413, 'media_too_large', { maxBytes: 10485760 }))).toBe(true);
    expect(isPerFileRefusal(problem(415, 'media_type_not_allowed'))).toBe(true);
    expect(isPerFileRefusal(new ProblemError(413, 'Request Entity Too Large'))).toBe(true);
  });

  it('is false for refusals the next file would meet too', () => {
    expect(isPerFileRefusal(problem(429, 'media_rate_limited', { retryAfterSeconds: 60 }))).toBe(
      false,
    );
    expect(isPerFileRefusal(problem(403, 'purpose_forbidden'))).toBe(false);
    expect(isPerFileRefusal(new ProblemError(502, 'Bad Gateway'))).toBe(false);
    expect(isPerFileRefusal(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('coreProblemMessage for a bare 413', () => {
  it("names core's single-step limit", () => {
    expect(coreProblemMessage(new ProblemError(413, 'Request Entity Too Large'))).toBe(
      'Dosya çok büyük: sunucu tek seferde en fazla 20 MB kabul ediyor.',
    );
  });
});
