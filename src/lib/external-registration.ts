/**
 * An Event's external registration link (core docs/attendee-import.md): an
 * absolute https address with a host, no user or password, no blank, at most
 * 2048 characters. Core checks the same and answers
 * `400 external_registration_url_invalid`.
 */
export const EXTERNAL_REGISTRATION_MAX = 2048;

/** Why a link cannot be saved, as a code; its sentence is in EXTERNAL_REGISTRATION_ISSUES. */
export type ExternalRegistrationIssueCode = 'too_long' | 'blank' | 'not_https' | 'credentials';

export const EXTERNAL_REGISTRATION_ISSUES: Record<ExternalRegistrationIssueCode, string> = {
  too_long: 'Dış kayıt bağlantısı çok uzun.',
  blank: 'Dış kayıt bağlantısı boşluk içeremez.',
  not_https: 'Dış kayıt bağlantısı https:// ile başlayan tam bir adres olmalı.',
  credentials: 'Dış kayıt bağlantısı kullanıcı adı ya da parola içeremez.',
};

/** Why the link cannot be saved, or null when it can (an empty one is none). */
export function externalRegistrationIssueCode(
  raw: string | undefined,
): ExternalRegistrationIssueCode | null {
  const link = (raw ?? '').trim();
  if (!link) return null;
  if (link.length > EXTERNAL_REGISTRATION_MAX) return 'too_long';
  if (/\s/.test(link)) return 'blank';
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return 'not_https';
  }
  if (url.protocol !== 'https:' || !url.hostname) return 'not_https';
  if (url.username || url.password) return 'credentials';
  return null;
}

/** The sentence of externalRegistrationIssueCode, or null. */
export function externalRegistrationIssue(raw: string | undefined): string | null {
  const code = externalRegistrationIssueCode(raw);
  return code ? EXTERNAL_REGISTRATION_ISSUES[code] : null;
}

/** Whether a form problem (eventFormIssue) is one of the link's codes: its section is Başvuru. */
export function isExternalRegistrationIssue(issue: string): boolean {
  return (Object.values(EXTERNAL_REGISTRATION_ISSUES) as string[]).includes(issue);
}
