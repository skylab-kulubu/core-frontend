import {
  APPLY_SLOT_KEY,
  emptyApplySlot,
  extraFormSlot,
  formsAdminOrigin,
  looksLikeSkyforms,
  type EventFormSlot,
} from '@/lib/event-forms';

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

const FORM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_ID = '00000000-0000-0000-0000-000000000000';

/** A Skyforms address typed as the external registration link. */
export type SkyformsLink = {
  /** The form, or null when the address names none. */
  formId: string | null;
  /** The form's public address (`https://<forms host>/<id>`), or null. */
  formUrl: string | null;
};

/**
 * Whether the external registration link is a Skyforms address: the host of
 * NEXT_PUBLIC_FORMS_ADMIN_URL, or forms./sandbox-forms. under
 * yildizskylab.com. Its answers write no Ticket from this box: core matches a
 * Skyforms answer only against the Event's Form fields
 * (internal/ticket/form_response.go). The form is the first UUID in the path,
 * as core reads a form address (event.FormIDFromURL), so an admin page's
 * address (/admin/forms/<id>/edit) names it too.
 */
export function skyformsLinkIn(
  raw: string | undefined,
  origin = formsAdminOrigin(),
): SkyformsLink | null {
  const link = (raw ?? '').trim();
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const clubForms =
    host.endsWith('.yildizskylab.com') &&
    (host.startsWith('forms.') || host.startsWith('sandbox-forms.'));
  if (!clubForms && !looksLikeSkyforms(link, origin)) return null;
  const formId =
    url.pathname.split('/').find((part) => FORM_ID.test(part) && part !== NIL_ID) ?? null;
  return { formId, formUrl: formId ? `${url.origin}/${formId}` : null };
}

/** Where moveSkyformsLink puts the form: the empty application slot, a new extra slot, or nowhere (already listed). */
export type SkyformsMoveTarget = 'apply' | 'extra' | 'listed';

/** The slot moveSkyformsLink would fill. */
export function skyformsMoveTarget(
  slots: EventFormSlot[],
  link: SkyformsLink,
  origin = formsAdminOrigin(),
): SkyformsMoveTarget {
  const rows = slots.length ? slots : [emptyApplySlot()];
  if (link.formId) {
    const id = link.formId.toLowerCase();
    const listed = rows.some(
      (slot) => skyformsLinkIn(slot.url, origin)?.formId?.toLowerCase() === id,
    );
    if (listed) return 'listed';
  }
  const apply = rows.find((slot) => slot.key === APPLY_SLOT_KEY);
  return apply && !apply.url.trim() ? 'apply' : 'extra';
}

/**
 * The Form slots with the external link's Skyforms form in them: the empty
 * application slot, else a new extra slot; unchanged when a slot already
 * lists the form. The caller empties the external registration link.
 */
export function moveSkyformsLink(
  slots: EventFormSlot[],
  link: SkyformsLink,
  origin = formsAdminOrigin(),
): EventFormSlot[] {
  const rows = slots.length ? slots : [emptyApplySlot()];
  if (!link.formUrl) return rows;
  const target = skyformsMoveTarget(rows, link, origin);
  if (target === 'listed') return rows;
  const mode = looksLikeSkyforms(link.formUrl, origin) ? 'skyforms' : 'external';
  if (target === 'apply') {
    return rows.map((slot) =>
      slot.key === APPLY_SLOT_KEY ? { ...slot, url: link.formUrl!, mode } : slot,
    );
  }
  const extra = extraFormSlot('Ek form');
  return [...rows, { ...extra, url: link.formUrl, mode }];
}
