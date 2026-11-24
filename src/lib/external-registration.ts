/**
 * An Event's external registration link (core docs/attendee-import.md): an
 * absolute https address with a host, no user or password, no blank, at most
 * 2048 characters. Core checks the same and answers
 * `400 external_registration_url_invalid`.
 */
export const EXTERNAL_REGISTRATION_MAX = 2048;

/** Why the link cannot be saved, or null when it can (an empty one is none). */
export function externalRegistrationIssue(raw: string | undefined): string | null {
  const link = (raw ?? '').trim();
  if (!link) return null;
  if (link.length > EXTERNAL_REGISTRATION_MAX) return 'Dış kayıt bağlantısı çok uzun.';
  if (/\s/.test(link)) return 'Dış kayıt bağlantısı boşluk içeremez.';
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return 'Dış kayıt bağlantısı https:// ile başlayan tam bir adres olmalı.';
  }
  if (url.protocol !== 'https:' || !url.hostname) {
    return 'Dış kayıt bağlantısı https:// ile başlayan tam bir adres olmalı.';
  }
  if (url.username || url.password)
    return 'Dış kayıt bağlantısı kullanıcı adı ya da parola içeremez.';
  return null;
}
