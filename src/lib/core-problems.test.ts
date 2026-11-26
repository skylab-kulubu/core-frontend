import { ProblemError } from '@/lib/api/core';
import {
  coreProblemMessage,
  formInUseOf,
  groupWriteProblemMessage,
  isFormInUse,
  isPerFileRefusal,
} from '@/lib/core-problems';

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
  it("never shows core's English detail for a code it does not know", () => {
    expect(
      coreProblemMessage(
        new ProblemError(400, 'Bad Request', {
          code: 'media_new_rule',
          detail: 'A new rule refused it.',
        }),
      ),
    ).toBe('İstek geçersiz. Girdiklerini denetleyip tekrar dene.');
  });

  it('says the status in Turkish, then the caller text for anything that is not a problem', () => {
    expect(coreProblemMessage(new ProblemError(500, 'Internal Server Error'))).toBe(
      'Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.',
    );
    expect(coreProblemMessage(new Error('boom'), 'Galeri yüklenemedi')).toBe('Galeri yüklenemedi');
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

describe('coreProblemMessage for a coded 413', () => {
  it('says the image has too many pixels, with the limit core sent', () => {
    expect(
      coreProblemMessage(
        problem(413, 'media_image_too_large', { purpose: 'event_cover', maxPixels: 50_000_000 }),
      ),
    ).toBe(
      'Görselin çözünürlüğü çok yüksek (en çok 50 milyon piksel). Daha küçük boyutta kaydedip yeniden yükle.',
    );
    expect(
      coreProblemMessage(
        problem(413, 'media_image_too_large', { purpose: 'event_cover', maxPixels: 12_500_000 }),
      ),
    ).toBe(
      'Görselin çözünürlüğü çok yüksek (en çok 12,5 milyon piksel). Daha küçük boyutta kaydedip yeniden yükle.',
    );
  });

  it('says the image has too many pixels without a limit when core sent none', () => {
    expect(
      coreProblemMessage(problem(413, 'media_image_too_large', { purpose: 'event_cover' })),
    ).toBe('Görselin çözünürlüğü çok yüksek. Daha küçük boyutta kaydedip yeniden yükle.');
  });

  it("names the purpose's own maximum, not the single-step limit", () => {
    expect(
      coreProblemMessage(
        problem(413, 'media_too_large', { purpose: 'event_cover', maxBytes: 10 * 1024 * 1024 }),
      ),
    ).toBe('Dosya çok büyük: Etkinlik kapağı için en fazla 10 MB yüklenebilir.');
    expect(coreProblemMessage(problem(413, 'media_too_large', { purpose: 'event_cover' }))).toBe(
      'Dosya Etkinlik kapağı için çok büyük.',
    );
  });

  it("uses the code's own message for other 413 codes", () => {
    expect(
      coreProblemMessage(problem(413, 'import_too_large', { maxBytes: 2 * 1024 * 1024 })),
    ).toBe("Liste 2 MB'tan büyük.");
    expect(coreProblemMessage(problem(413, 'import_too_many_rows', { maxRows: 1000 }))).toBe(
      'Liste 1000 satırdan uzun; böl ve ayrı ayrı içe aktar.',
    );
  });

  it('never names the single-step limit for a 413 code it does not know', () => {
    expect(coreProblemMessage(problem(413, 'media_new_limit'))).toBe('Dosya çok büyük.');
  });
});

describe('coreProblemMessage for any core refusal', () => {
  it.each([
    [400, 'Bad Request', 'İstek geçersiz. Girdiklerini denetleyip tekrar dene.'],
    [401, 'Unauthorized', 'Oturumun sona ermiş. Sayfayı yenileyip yeniden giriş yap.'],
    [403, 'Forbidden', 'Bu işlem için yetkin yok.'],
    [404, 'Not Found', 'Kayıt bulunamadı; silinmiş olabilir.'],
    [
      409,
      'Conflict',
      'Kayıt şu anki durumunda buna uygun değil ya da aynı bilgilerle başka bir kayıt var.',
    ],
    [410, 'Gone', 'Kayıt artık yok.'],
    [422, 'Unprocessable Entity', 'Gönderilen bilgiler geçersiz. Alanları denetleyip tekrar dene.'],
    [429, 'Too Many Requests', 'Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.'],
    [502, 'Bad Gateway', 'Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.'],
    [503, 'HTTP 503', 'Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.'],
  ])('says %i (%s) in Turkish', (status, title, message) => {
    expect(coreProblemMessage(new ProblemError(status, title), 'Kaydedilemedi')).toBe(message);
  });

  it("keeps the caller's text for a status it has no sentence for", () => {
    expect(coreProblemMessage(new ProblemError(418, "I'm a teapot"), 'Kaydedilemedi')).toBe(
      'Kaydedilemedi',
    );
  });

  it('says the server could not be reached when fetch itself failed', () => {
    for (const message of [
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Load failed',
    ]) {
      expect(coreProblemMessage(new TypeError(message), 'Kaydedilemedi')).toBe(
        'Sunucuya ulaşılamadı. Bağlantını denetleyip tekrar dene.',
      );
    }
  });

  it.each([
    [400, 'Bad Request', 'İstek geçersiz. Girdiklerini denetleyip tekrar dene.'],
    [403, 'Forbidden', 'Bu işlem için yetkin yok.'],
    [404, 'Not Found', 'Kayıt bulunamadı; silinmiş olabilir.'],
    [
      409,
      'Conflict',
      'Kayıt şu anki durumunda buna uygun değil ya da aynı bilgilerle başka bir kayıt var.',
    ],
    [422, 'Unprocessable Entity', 'Gönderilen bilgiler geçersiz. Alanları denetleyip tekrar dene.'],
  ])(
    "never shows core's English title or detail on a %i: the status says it in Turkish",
    (status, title, message) => {
      const said = coreProblemMessage(
        new ProblemError(status, title, {
          detail: 'session ss-1 is referenced by 3 check-ins and cannot be deleted',
        }),
        'Kaydedilemedi',
      );
      expect(said).toBe(message);
      expect(said).not.toContain(title);
      expect(said).not.toContain('referenced');
    },
  );

  it('says the caller’s general Turkish text for a status it has no sentence for', () => {
    expect(
      coreProblemMessage(
        new ProblemError(418, "I'm a teapot", { detail: 'An English sentence.' }),
        'Kaydedilemedi',
      ),
    ).toBe('Kaydedilemedi');
  });

  it('uses a Turkish sentence for the codes the panel meets, over the detail', () => {
    expect(
      coreProblemMessage(
        new ProblemError(403, 'Session Not Open', { code: 'session_closed', detail: 'closed' }),
        'x',
      ),
    ).toBe('Bu oturum şu an girişe açık değil.');
    expect(
      coreProblemMessage(new ProblemError(403, 'Forbidden', { code: 'event_managed' }), 'x'),
    ).toBe('Bu kısa link bir etkinliğe ait; etkinliğin sayfasından değiştir.');
    expect(coreProblemMessage(new ProblemError(409, 'Conflict', { code: 'managed' }), 'x')).toBe(
      'Bu kısa link sistem tarafından yönetiliyor; buradan değiştirilemez.',
    );
  });

  it("says core's own English titles without a code in Turkish", () => {
    expect(coreProblemMessage(new ProblemError(409, 'Ambiguous Match'), 'x')).toBe(
      'Bu adla birden fazla kayıt var; e-posta ile dene.',
    );
    expect(coreProblemMessage(new ProblemError(422, 'No mail recipients'), 'x')).toBe(
      'Mail gönderilecek alıcı yok.',
    );
    expect(coreProblemMessage(new ProblemError(503, 'SkyNotify is not configured'), 'x')).toBe(
      'Mail gönderimi şu an kullanılamıyor; yöneticiye haber ver.',
    );
  });

  it('lets the caller word a status for its own action', () => {
    expect(
      coreProblemMessage(new ProblemError(403, 'Forbidden'), 'x', {
        403: 'Bunu geri almaya yetkin yok.',
      }),
    ).toBe('Bunu geri almaya yetkin yok.');
    expect(
      coreProblemMessage(new ProblemError(500, 'Internal Server Error'), 'x', {
        403: 'Bunu geri almaya yetkin yok.',
      }),
    ).toBe('Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.');
  });

  it("never shows core's detail on a server error: it can name internal paths and roles", () => {
    expect(
      coreProblemMessage(
        new ProblemError(502, 'Bad Gateway', { detail: 'mail: POST /v1/lists/x status 500' }),
        'x',
      ),
    ).toBe('Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.');
    expect(
      coreProblemMessage(
        new ProblemError(503, 'Service Unavailable', {
          detail: 'mail: lists forbidden — grant skynotify:lists:write on core SA',
        }),
        'x',
      ),
    ).toBe('Sunucu isteği tamamlayamadı. Biraz sonra tekrar dene.');
  });

  it("treats core's RFC 9110 status names as saying nothing more", () => {
    expect(
      coreProblemMessage(
        new ProblemError(422, 'Bad Request', { detail: 'Unprocessable Content' }),
        'x',
      ),
    ).toBe('Gönderilen bilgiler geçersiz. Alanları denetleyip tekrar dene.');
    expect(
      coreProblemMessage(
        new ProblemError(400, 'Bad Request', { detail: 'Content Too Large' }),
        'x',
      ),
    ).toBe('İstek geçersiz. Girdiklerini denetleyip tekrar dene.');
  });

  it.each([
    ['ytu_managed_field', 409, 'Bu alan YTÜ hesabından geliyor; buradan değiştirilemez.'],
    ['event_not_published', 409, 'Etkinlik henüz yayımlanmadı.'],
    ['event_cancelled', 409, 'Etkinlik iptal edilmiş.'],
    ['event_has_tickets', 409, 'Etkinliğin kaydı var; taslağa alınamaz.'],
    ['event_has_competitors', 409, 'Etkinliğin yarışmacısı var; taslağa alınamaz.'],
    ['event_ended', 409, 'Etkinlik bitmiş; iptal edilemez.'],
    ['event_not_draft', 409, 'Yalnız taslak etkinlik silinir.'],
    ['event_not_cancelled', 409, 'Etkinlik iptal edilmemiş.'],
    ['registration_closed', 409, 'Etkinliğin başvurusu kapalı.'],
    ['event_location_invalid', 400, 'Konum geçersiz: noktayı ve açık adresi denetle.'],
    ['background_pdf_pages', 400, 'PDF arka plan tek sayfa olmalı.'],
    ['layout_not_verifiable', 400, "Doğrulama QR'ı ya da sertifika kodundan biri gerekli."],
    ['layout_element_out_of_bounds', 400, 'Bir katman sayfanın dışına taşıyor.'],
    ['render_failed', 400, 'PDF oluşturulamadı; sürerse yöneticiye haber ver.'],
    ['renderer_unavailable', 503, 'PDF oluşturucu kapalı; biraz sonra tekrar dene.'],
    [
      'asset_type_unsupported',
      400,
      'Dosya türü desteklenmiyor: görseller PNG, JPEG, WebP ya da SVG olmalı; arka plan PDF de olabilir.',
    ],
    [
      'event_attendee_note_invalid',
      400,
      'Katılımcı notu geçersiz: en çok 1000 karakter, görünmez karakter olmasın.',
    ],
    [
      'event_ticket_note_invalid',
      400,
      'Bilet duyurusu en çok 500 karakter olabilir, görünmez karakter içermemeli.',
    ],
    [
      'invalid_name',
      422,
      'Grup adı 2-24 karakter olmalı: büyük harfle başlar, yalnız büyük harf (A-Z), rakam ve tire içerir (ör. WEBLAB, AI-LAB).',
    ],
    ['reserved_name', 422, 'Bu grup adı ayrılmış; başka bir ad seç.'],
    ['name_taken', 409, 'Bu ad başka bir grupta ya da kayıtta kullanılıyor; başka bir ad seç.'],
    ['privileged_root', 409, 'Bu grubun adı değiştirilemez: üyelerinin yönetim yetkisi değişirdi.'],
  ])('says %s in Turkish', (code, status, message) => {
    expect(
      coreProblemMessage(
        new ProblemError(status, 'Conflict', { code, detail: 'An English sentence.' }),
        'x',
      ),
    ).toBe(message);
  });
});

describe('coreProblemMessage for the role rules', () => {
  it('says each placement reason in Turkish, never core English detail', () => {
    const message = coreProblemMessage(problem(409, 'role_placement', { reason: 'team' }));
    expect(message).toContain('Ekip ya da alt ekip grubuna rol verilmez');
    expect(message).not.toContain('Core detail');
  });

  it('says the rule itself for a placement without a known reason', () => {
    expect(coreProblemMessage(problem(409, 'role_placement', { reason: 'new_reason' }))).toContain(
      'Roller yalnız yönetim köküne',
    );
    expect(coreProblemMessage(problem(409, 'role_placement'))).toContain('Bu gruba rol verilemez');
  });

  it('names the group path for a direct role, and the console for Keycloak admin roles', () => {
    expect(coreProblemMessage(problem(403, 'direct_role_not_allowed'))).toContain(
      'Kişiye doğrudan rol verilmez',
    );
    expect(coreProblemMessage(problem(403, 'keycloak_admin_role'))).toContain('panelden verilmez');
    expect(coreProblemMessage(problem(403, 'keycloak_admin_group'))).toContain(
      'üyeliği panelden değişmez',
    );
  });
});

describe('groupWriteProblemMessage', () => {
  it('says a role group stays a leaf on a create', () => {
    expect(
      groupWriteProblemMessage(
        problem(409, 'role_placement', { reason: 'roles_group_not_leaf' }),
        'create',
        'Oluşturulamadı',
      ),
    ).toBe('Rol grubunun altına grup açılmaz; /ROLLER altındaki rol grupları tek katmandır.');
  });

  it('puts the rename context before the placement reason on a save', () => {
    expect(
      groupWriteProblemMessage(
        problem(409, 'role_placement', { reason: 'area' }),
        'save',
        'Kaydedilemedi',
      ),
    ).toMatch(
      /^Yeni adla bu gruptaki roller kurala aykırı bir yere düşerdi: Alan grubuna rol verilmez/,
    );
  });

  it('reads any other refusal as coreProblemMessage', () => {
    expect(groupWriteProblemMessage(problem(409, 'name_taken'), 'save', 'Kaydedilemedi')).toContain(
      'Bu ad başka bir grupta',
    );
  });

  it('names what a publish is missing', () => {
    expect(
      coreProblemMessage(
        new ProblemError(400, 'Bad Request', {
          code: 'event_incomplete',
          fields: { missing: ['location', 'startDate'] },
        }),
        'x',
      ),
    ).toBe('Yayınlamak için eksik: konum, başlangıç tarihi.');
  });

  it('names the e-mail columns an import cannot choose between', () => {
    expect(
      coreProblemMessage(
        new ProblemError(400, 'Bad Request', {
          code: 'import_ambiguous_email_column',
          fields: { columns: ['E-posta', 'Okul e-postası'] },
        }),
        'x',
      ),
    ).toBe('Birden fazla e-posta sütunu var: E-posta, Okul e-postası. Birini silip yeniden yükle.');
    expect(
      coreProblemMessage(
        new ProblemError(400, 'Bad Request', { code: 'import_ambiguous_email_column' }),
        'x',
      ),
    ).toBe('Birden fazla e-posta sütunu var. Birini silip yeniden yükle.');
  });
});

describe('form_in_use (ADR 0069, 2026-11-22)', () => {
  const formId = '0b6f1c1e-6a39-4d0f-9d0c-3a8c5d1e2f00';
  const named = problem(409, 'form_in_use', {
    formId,
    event: { id: 'e9', name: 'Gecekodu 2025', status: 'published' },
  });

  it('names the event that holds the form when core says it', () => {
    expect(coreProblemMessage(named, 'x')).toBe(
      'Bu form şu etkinlikte kullanılıyor: Gecekodu 2025.',
    );
    expect(formInUseOf(named)).toEqual({ formId, event: { id: 'e9', name: 'Gecekodu 2025' } });
  });

  it('says only that the form is elsewhere when core names no event', () => {
    const unnamed = problem(409, 'form_in_use', { formId });
    expect(coreProblemMessage(unnamed, 'x')).toBe(
      'Bu form başka bir yerde kullanılıyor; başka bir form seç.',
    );
    expect(formInUseOf(unnamed)).toEqual({ formId });
    // An older core sends no form: nothing to point at
    expect(formInUseOf(problem(409, 'form_in_use'))).toBeNull();
    expect(formInUseOf(problem(409, 'name_taken', { formId }))).toBeNull();
  });

  it('matches the refused form in a slot address, whatever its case', () => {
    const inUse = formInUseOf(named);
    expect(isFormInUse(`https://forms.example.test/${formId.toUpperCase()}`, inUse)).toBe(true);
    expect(isFormInUse('https://forms.example.test/other', inUse)).toBe(false);
    expect(isFormInUse('', inUse)).toBe(false);
    expect(isFormInUse(`https://forms.example.test/${formId}`, null)).toBe(false);
  });
});
