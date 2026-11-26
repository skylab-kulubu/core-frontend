import { ProblemError } from '@/lib/api/core';
import { mediaPurposeLabel, mediaRoleName } from '@/lib/media-purposes';
import { rolePlacementMessage } from '@/lib/role-placement';
import { passwordPolicyMessage } from '@/lib/user-account';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

function formatBytes(bytes: number): string {
  if (bytes >= GIB) return `${oneDecimal(bytes / GIB)} GB`;
  return `${oneDecimal(bytes / MIB)} MB`;
}

/** A pixel count in Turkish: `50 milyon piksel`, `12,5 milyon piksel`, `800.000 piksel`. */
function formatPixels(pixels: number): string {
  if (pixels >= 1_000_000) return `${oneDecimal(pixels / 1_000_000)} milyon piksel`;
  return `${pixels.toLocaleString('tr-TR')} piksel`;
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
  event_has_tickets: 'Etkinliğin kaydı var; taslağa alınamaz.',
  event_has_competitors: 'Etkinliğin yarışmacısı var; taslağa alınamaz.',
  event_ended: 'Etkinlik bitmiş; iptal edilemez.',
  event_not_draft: 'Yalnız taslak etkinlik silinir.',
  event_not_cancelled: 'Etkinlik iptal edilmemiş.',
  registration_closed: 'Etkinliğin başvurusu kapalı.',
  // An Event's place (core docs/event-location.md): a half point, one off the globe, a control character
  event_location_invalid: 'Konum geçersiz: noktayı ve açık adresi denetle.',
  // The external registration link and the attendee import (core docs/attendee-import.md)
  external_registration_url_invalid:
    'Dış kayıt bağlantısı https:// ile başlayan tam bir adres olmalı.',
  import_empty: 'Listede satır yok.',
  import_no_email_column: 'Listede e-posta sütunu bulunamadı. Başlığa "E-posta" yaz.',
  import_ambiguous_email_column: 'Birden fazla e-posta sütunu var. Birini silip yeniden yükle.',
  import_unreadable: 'Liste okunamadı. Dosyayı UTF-8 CSV olarak kaydet.',
  import_too_large: "Liste 2 MB'tan büyük.",
  import_too_many_rows: 'Liste 1000 satırdan uzun; böl ve ayrı ayrı içe aktar.',
  // The Event's theme and accent (core docs/event-theme.md)
  event_theme_unknown: 'Bu tema sunucuda yok. Sayfayı yenileyip yeniden seç.',
  event_ticket_accent_color_invalid: 'Vurgu rengi #RRGGBB biçiminde olmalı.',
  // The attendee note (core docs/attendance-mail.md): over 1000 characters or an invisible character
  event_attendee_note_invalid:
    'Katılımcı notu geçersiz: en çok 1000 karakter, görünmez karakter olmasın.',
  // The ticket note (core docs/ticket-note.md): over 500 characters or an invisible character
  event_ticket_note_invalid:
    'Bilet duyurusu en çok 500 karakter olabilir, görünmez karakter içermemeli.',
  // Sending a Ticket again, renewing its link (core docs/ticket-resend.md)
  ticket_resend_rate_limited:
    'Bu bilet çok sık gönderildi (saatte 3, günde 6). Bir saat sonra tekrar dene.',
  ticket_notification_off: 'Bilet postası kapalı; bilet gönderilemiyor.',
  ticket_holder_erased: 'Bilet sahibinin hesabı silinmiş; gönderilecek kimse yok.',
  // A Ticket's status (core docs/ticket-cancellation.md): the door and the panel's ticket writes
  ticket_cancelled: 'Bilet iptal edilmiş.',
  ticket_waitlisted: 'Bilet bekleme listesinde.',
  ticket_checked_in: 'Girişi olan bilet iptal edilemez; önce girişi geri al.',
  ticket_in_competition: 'Kişi yarışmada; önce yarışmadan çıkar.',
  audit_unavailable: 'İşlem kaydı açılamadı; hiçbir şey gönderilmedi. Biraz sonra tekrar dene.',
  // One form in one place (ADR 0069 and its addendum of 2026-11-22); the named Event: formInUseOf
  form_in_use: 'Bu form başka bir yerde kullanılıyor; başka bir form seç.',
  // Linking a form the person is not on the team of in Forms (core docs/form-respondents.md)
  forms_access_denied: 'Bu forma erişimin yok.',
  forms_unavailable: 'Forms yanıt vermedi. Biraz sonra dene.',
  feedback_form_missing: 'Geri bildirim formu bağlı değil.',
  feedback_not_sendable: 'Taslak, iptal edilmiş ya da arşivlenmiş etkinliğin formu gönderilmez.',
  ytu_managed_field: 'Bu alan YTÜ hesabından geliyor; buradan değiştirilemez.',
  // A person's account from the person card (core docs/user-accounts.md)
  own_account: 'Kendi hesabını Hesap merkezinden değiştir.',
  privileged_target: 'Yönetim üyesinin hesabını yalnız ADMIN değiştirir.',
  service_account: 'Servis hesabı buradan değiştirilmez.',
  account_not_active: 'Hesap silinmiş ya da siliniyor.',
  school_domain: 'Okul adresi buradan eklenmez; YTÜ hesabı bağlanınca gelir.',
  email_invalid: 'E-posta adresi geçerli değil.',
  email_taken: 'Bu adres başka bir hesapta.',
  email_not_verified: 'Önce kişisel adresi onayla.',
  no_address: 'Bu adres hesapta yok.',
  no_email: 'Hesapta e-posta adresi yok.',
  unknown_required_action: 'Bu eylem seçilemez.',
  credential_not_found: 'Kimlik bilgisi bulunamadı; sayfayı yenile.',
  provider_not_found: 'Bağlantı bulunamadı; sayfayı yenile.',
  mail_not_sent: 'E-posta gönderilemedi. Biraz sonra tekrar dene.',
  resend_too_soon: 'Herkese yeniden gönderme 10 dakikada bir yapılabilir.',
  // Certificate templates: saving, preview, publish (core docs/certificate-template-errors.md)
  template_name_invalid: 'Şablon adı gerekli (en çok 160 karakter).',
  template_source_invalid: 'Kaynak bağlantısı geçerli bir http(s) adresi olmalı.',
  layout_size_invalid: 'Sayfa boyutu her kenarda 300–4000 px olmalı.',
  layout_orientation_invalid: 'Sayfa yönü yatay ya da dikey olmalı.',
  layout_color_invalid: 'Bir renk geçerli değil.',
  layout_element_count: 'Tasarımda 1–100 katman olmalı.',
  layout_element_id_invalid: 'Bir katmanın kimliği bozuk; katmanı silip yeniden ekle.',
  layout_element_kind_unknown: 'Tasarımda tanınmayan bir katman var.',
  layout_element_out_of_bounds: 'Bir katman sayfanın dışına taşıyor.',
  layout_element_style_invalid: 'Bir katmanın yazı ya da kenar ayarı sınır dışında.',
  layout_text_too_long: 'Bir metin 4000 karakterden uzun.',
  layout_image_missing: 'Bir görsel katmanının dosyası yok.',
  layout_recipient_name_missing: 'Katılımcı adı katmanı gerekli.',
  layout_not_verifiable: "Doğrulama QR'ı ya da sertifika kodundan biri gerekli.",
  layout_background_placement_invalid: 'Arka plan yerleşimi geçerli değil.',
  background_size_unknown: 'Arka plan görselinin boyutu okunamadı.',
  co_organizer_person_dates: 'Ortak kişi olarak etkinliğin bitişini ileri alamazsın.',
  template_event_scoped: 'Etkinliğe özel şablon yalnız kendi etkinliğinde kullanılır.',
  template_event_exists: 'Bu etkinliğin zaten kendi şablonu var.',
  asset_empty: 'Arka plan ya da görsel dosyası boş; yeniden yükle.',
  asset_too_large: 'Görseller çok büyük (tek görsel 20 MB, toplam 50 MB).',
  asset_type_unsupported:
    'Dosya türü desteklenmiyor: görseller PNG, JPEG, WebP ya da SVG olmalı; arka plan PDF de olabilir.',
  asset_storage_unavailable: 'Dosya deposuna şu an ulaşılamıyor; biraz sonra tekrar dene.',
  background_pdf_unreadable: "PDF arka plan okunamadı; PDF'i yeniden dışa aktar ya da PNG yükle.",
  background_pdf_too_large: "PDF arka plan 20 MB'tan büyük.",
  background_pdf_pages: 'PDF arka plan tek sayfa olmalı.',
  background_pdf_encrypted: 'PDF parolalı ya da şifreli; parolasız dışa aktarıp yeniden yükle.',
  background_pdf_no_text:
    "PDF'te düzenlenebilir metin yok: yazılar eğriye çevrilmiş ya da sayfa bir görsel.",
  background_text_selection_empty:
    'Dönüştürülecek metin seçilmedi ya da seçilenler artık dönüştürülemiyor; listeyi yeniden aç.',
  background_text_strip_failed: "Seçilen metinler PDF'ten silinemedi; PDF değişmedi.",
  // Certificate fonts (core docs/certificate-fonts.md)
  font_unreadable: 'Dosya okunamadı: TTF, OTF ya da WOFF2 bir yazı tipi olmalı.',
  font_too_large: "Yazı tipi 10 MB'tan büyük.",
  font_unsupported:
    'Değişken yazı tipi ya da koleksiyon (TTC) yüklenmez; tek bir kalınlığın dosyasını yükle.',
  font_embedding_restricted: 'Bu yazı tipinin lisansı gömmeye izin vermiyor.',
  font_exists: 'Bu ekipte bu aile, kalınlık ve stilde bir yazı tipi zaten var.',
  layout_font_out_of_scope:
    'Bir katmanın yazı tipi bu şablonun ekibine ya da kulübe ait değil ya da arşivlenmiş; başka yazı tipi seç.',
  pdf_tools_unavailable: 'PDF araçlarına şu an ulaşılamıyor; biraz sonra tekrar dene.',
  renderer_unavailable: 'PDF oluşturucu kapalı; biraz sonra tekrar dene.',
  render_failed: 'PDF oluşturulamadı; sürerse yöneticiye haber ver.',
  name_invalid: 'Ad ya da soyad kabul edilmedi; izin verilmeyen bir karakter içeriyor olabilir.',
  account_invalid: 'Hesap bilgisi kabul edilmedi.',
  // Group name refusals (core teamcode)
  invalid_name:
    'Grup adı 2-24 karakter olmalı: büyük harfle başlar, yalnız büyük harf (A-Z), rakam ve tire içerir (ör. WEBLAB, AI-LAB).',
  reserved_name: 'Bu grup adı ayrılmış; başka bir ad seç.',
  name_taken: 'Bu ad başka bir grupta ya da kayıtta kullanılıyor; başka bir ad seç.',
  privileged_root: 'Bu grubun adı değiştirilemez: üyelerinin yönetim yetkisi değişirdi.',
  // Role rules (core rol-temizligi 06): access comes through Groups only
  direct_role_not_allowed:
    'Kişiye doğrudan rol verilmez; kişiyi rolü taşıyan gruba ekle (/ROLLER altındaki rol grubu, ekibin lider grubu ya da yönetim kökü).',
  keycloak_admin_role: 'Bu rol hesap sisteminin yönetim yetkisini taşıyor; panelden verilmez.',
  keycloak_admin_group:
    'Bu grup (ya da üstündeki bir grup) hesap sisteminin yönetim yetkisini taşıyor; üyeliği panelden değişmez.',
  // KVKK md. 11 register (core docs/subject-requests.md)
  received_on_invalid: 'Başvuru tarihi geçerli bir gün olmalı ve bugünden sonra olamaz.',
  channel_invalid: 'Kanal seç.',
  requester_name_invalid: 'Ad soyad gerekli (en çok 200 karakter).',
  requester_contact_invalid: 'Cevabın gideceği adres gerekli (en çok 320 karakter).',
  user_invalid:
    'Hesap kimliği geçerli değil: Kullanıcılar ekranındaki kimliği olduğu gibi yapıştır.',
  user_unknown: 'Bu kimlikte bir hesap yok.',
  request_types_invalid: 'En az bir talep türü seç.',
  status_invalid: 'Durum seç.',
  answered_on_required: 'Sonuçlanan başvuruda cevap tarihi gerekli.',
  answered_on_invalid:
    'Cevap tarihi başvurudan önce ya da bugünden sonra olamaz; açık başvuruda boş kalır.',
  answer_summary_invalid: 'Cevap özeti en çok 2000 karakter.',
  responder_invalid: 'Yanıtlayan en çok 100 karakter.',
  subject_request_changed:
    'Başvuru sen açtıktan sonra başkası tarafından değiştirildi. Çekmeceyi kapatıp yeniden aç, sonra tekrar kaydet.',
};

/**
 * Where a form core refused with `409 form_in_use` is (ADR 0069, addendum of
 * 2026-11-22): the form, and the current Event that holds it when the reader
 * may see that Event. core leaves the Event out for another team's draft and
 * for the Event's own other slot.
 */
export type FormInUse = { formId: string; event?: { id: string; name: string } };

export function formInUseOf(error: unknown): FormInUse | null {
  if (!(error instanceof ProblemError) || error.code !== 'form_in_use') return null;
  const formId = text(error.fields.formId);
  if (!formId) return null;
  const holder = error.fields.event as Record<string, unknown> | undefined;
  const id = text(holder?.id);
  const name = text(holder?.name);
  return id && name ? { formId, event: { id, name } } : { formId };
}

/** Whether `url` is the form a form_in_use refusal is about. */
export function isFormInUse(url: string, inUse: FormInUse | null | undefined): boolean {
  return Boolean(inUse && url.trim() && url.toLowerCase().includes(inUse.formId.toLowerCase()));
}

/** The Event fields core names in `event_incomplete`. */
const EVENT_FIELD_NAMES: Record<string, string> = {
  name: 'ad',
  location: 'konum',
  startDate: 'başlangıç tarihi',
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
  'SkyNotify is not configured': 'Mail gönderimi şu an kullanılamıyor; yöneticiye haber ver.',
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
    case 'password_policy':
      return passwordPolicyMessage(fields.policy);
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
      return maxBytes > 0
        ? `Dosya çok büyük: ${purposeOf(error)} için en fazla ${formatBytes(maxBytes)} yüklenebilir.`
        : `Dosya ${purposeOf(error)} için çok büyük.`;
    }
    case 'media_image_too_large': {
      const maxPixels = Number(fields.maxPixels);
      const limit = maxPixels > 0 ? ` (en çok ${formatPixels(maxPixels)})` : '';
      return `Görselin çözünürlüğü çok yüksek${limit}. Daha küçük boyutta kaydedip yeniden yükle.`;
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
    case 'event_incomplete': {
      const missing = Array.isArray(fields.missing)
        ? fields.missing
            .map((field) => EVENT_FIELD_NAMES[text(field)] ?? text(field))
            .filter(Boolean)
        : [];
      return missing.length
        ? `Yayınlamak için eksik: ${missing.join(', ')}.`
        : 'Yayınlamak için ad, konum ve başlangıç tarihi gerekli.';
    }
    case 'import_ambiguous_email_column': {
      const columns = Array.isArray(fields.columns) ? fields.columns.map(text).filter(Boolean) : [];
      return columns.length
        ? `Birden fazla e-posta sütunu var: ${columns.join(', ')}. Birini silip yeniden yükle.`
        : CODE_MESSAGES.import_ambiguous_email_column;
    }
    case 'form_in_use': {
      const name = formInUseOf(error)?.event?.name;
      return name ? `Bu form şu etkinlikte kullanılıyor: ${name}.` : CODE_MESSAGES.form_in_use;
    }
    case 'media_team_mismatch':
      return 'Bu fotoğraf başka bir ekibin etkinliğinde kullanılıyor. Yalnız kendi ekibinin fotoğraflarını kullanabilirsin.';
    default:
      if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
      if (error.status === 413) {
        // Only a bare 413 is the HTTP server's single-step ceiling; a coded
        // one is some other limit this table does not know yet.
        return error.code
          ? 'Dosya çok büyük.'
          : `Dosya çok büyük: sunucu tek seferde en fazla ${formatBytes(SINGLE_STEP_MAX_BYTES)} kabul ediyor.`;
      }
      if (TITLE_MESSAGES[error.title]) return TITLE_MESSAGES[error.title];
      return (
        statusText[error.status] ??
        STATUS_MESSAGES[error.status] ??
        (error.status >= 500 ? SERVER_FAILED : fallback)
      );
  }
}
