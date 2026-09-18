import type { ShortUrl, ShortUrlBody } from '@/lib/api/urls';

export type EventFormMode = 'external' | 'skyforms';

export type EventFormLink = {
  label: string;
  url: string;
  alias?: string;
};

export type EventFormSlot = {
  key: string;
  label: string;
  mode: EventFormMode;
  url: string;
  alias: string;
  urlId?: string;
};

export const APPLY_SLOT_KEY = 'apply';
export const APPLY_SLOT_LABEL = 'Başvuru formu';
export const DEFAULT_FORMS_ADMIN_ORIGIN = 'https://forms.yildizskylab.com/admin';

export function emptyApplySlot(): EventFormSlot {
  return {
    key: APPLY_SLOT_KEY,
    label: APPLY_SLOT_LABEL,
    mode: 'external',
    url: '',
    alias: '',
  };
}

export function extraFormSlot(label: string, key?: string): EventFormSlot {
  const trimmed = label.trim() || 'Ek form';
  return {
    key:
      key ??
      `extra-${trimmed.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
    label: trimmed,
    mode: 'external',
    url: '',
    alias: '',
  };
}

export function aliasYear(startLocal: string, now = new Date()): number {
  const y = Number((startLocal ?? '').slice(0, 4));
  if (y >= 2000 && y <= 2100) return y;
  return now.getFullYear();
}

export function slugYearAlias(name: string, year: number, extra = ''): string {
  const slug = slugPart(name);
  const extraSlug = slugPart(extra);
  const head = [slug, extraSlug].filter(Boolean).join('-') || 'etkinlik';
  return `${head}${year}`;
}

export function humanFormAlias(ownerTeam: string, name: string, year: number, extra = ''): string {
  const team = slugPart(ownerTeam).replace(/-/g, '');
  const event = slugPart(name).replace(/-/g, '');
  const extraSlug = slugPart(extra).replace(/-/g, '');
  const namePart = [event, extraSlug].filter(Boolean).join('');
  if (team && namePart) return `${team}.${namePart}${year}`;
  return slugYearAlias(name || ownerTeam, year, extra);
}

export function shortAliasFromSlug(slug: string): string {
  return slug
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function slugPart(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function formsAdminOrigin(env = process.env.NEXT_PUBLIC_FORMS_ADMIN_URL): string {
  const trimmed = (env ?? '').trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_FORMS_ADMIN_ORIGIN;
}

export function withFormSlot(returnTo: string, slotKey: string): string {
  try {
    const url = new URL(returnTo);
    url.searchParams.set('formSlot', slotKey);
    url.searchParams.delete('formUrl');
    return url.toString();
  } catch {
    return returnTo;
  }
}

export function formHandoffFromSearch(search: {
  get(name: string): string | null;
}): { formUrl: string; formSlot: string } | null {
  const formUrl = (search.get('formUrl') ?? '').trim();
  if (!formUrl) return null;
  try {
    const parsed = new URL(formUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  const formSlot = (search.get('formSlot') ?? '').trim() || APPLY_SLOT_KEY;
  return { formUrl, formSlot };
}

export function applyFormHandoff(
  slots: EventFormSlot[],
  handoff: { formUrl: string; formSlot: string },
): EventFormSlot[] {
  const rows = slots.length ? slots : [emptyApplySlot()];
  let found = false;
  const next = rows.map((slot) => {
    if (slot.key !== handoff.formSlot) return slot;
    found = true;
    return { ...slot, url: handoff.formUrl, mode: 'skyforms' as const };
  });
  if (found) return next;
  if (handoff.formSlot === APPLY_SLOT_KEY) {
    return [
      { ...emptyApplySlot(), url: handoff.formUrl, mode: 'skyforms' },
      ...rows.filter((slot) => slot.key !== APPLY_SLOT_KEY),
    ];
  }
  const extra = extraFormSlot(handoff.formSlot, handoff.formSlot);
  extra.url = handoff.formUrl;
  extra.mode = 'skyforms';
  return [...next, extra];
}

export function skyformsCreateHref(origin: string, returnTo: string): string | null {
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const url = new URL(`${trimmed}/forms/new-form`);
  if (returnTo) url.searchParams.set('returnTo', returnTo);
  return url.toString();
}

export function looksLikeSkyforms(url: string, origin = formsAdminOrigin()): boolean {
  if (!url.trim()) return false;
  try {
    const host = new URL(url).hostname;
    if (origin) {
      return host === new URL(origin).hostname;
    }
    return host.endsWith('yildizskylab.com') && host.startsWith('forms.');
  } catch {
    return false;
  }
}

export function slotsFromEvent(
  event: {
    formUrl?: string;
    formAlias?: string;
    extraFormUrls?: EventFormLink[];
  },
  origin?: string,
): EventFormSlot[] {
  const apply = emptyApplySlot();
  apply.url = event.formUrl ?? '';
  apply.alias = event.formAlias ?? '';
  if (looksLikeSkyforms(apply.url, origin)) apply.mode = 'skyforms';
  const extras = (event.extraFormUrls ?? []).map((row, index) => {
    const slot = extraFormSlot(row.label || 'Ek form', `extra-${index}-${row.label || 'form'}`);
    slot.url = row.url ?? '';
    slot.alias = row.alias ?? '';
    if (looksLikeSkyforms(slot.url, origin)) slot.mode = 'skyforms';
    return slot;
  });
  return [apply, ...extras];
}

export function persistableFormFields(slots: EventFormSlot[]): {
  formUrl: string;
  formAlias: string;
  extraFormUrls: EventFormLink[];
} {
  const [apply, ...extras] = slots.length ? slots : [emptyApplySlot()];
  return {
    formUrl: apply?.url.trim() ?? '',
    formAlias: apply?.alias.trim() ?? '',
    extraFormUrls: extras
      .filter((slot) => slot.url.trim() || slot.label.trim())
      .map((slot) => ({
        label: slot.label.trim() || 'Ek form',
        url: slot.url.trim(),
        alias: slot.alias.trim() || undefined,
      })),
  };
}

export function existingShortFor(
  url: string,
  alias: string,
  rows: ShortUrl[],
): ShortUrl | undefined {
  const dest = url.trim();
  const slug = alias.trim();
  return rows.find((row) => (slug && row.alias === slug) || (dest && row.url === dest));
}

export async function attachFormAliases(
  slots: EventFormSlot[],
  name: string,
  startLocal: string,
  create: (body: ShortUrlBody) => Promise<ShortUrl>,
): Promise<EventFormSlot[]> {
  const year = aliasYear(startLocal);
  const out: EventFormSlot[] = [];
  for (const slot of slots) {
    const url = slot.url.trim();
    if (!url || slot.urlId || slot.alias.trim()) {
      out.push({ ...slot, url });
      continue;
    }
    const extra = slot.key === APPLY_SLOT_KEY ? '' : slot.label;
    const alias = shortAliasFromSlug(slot.alias.trim() || slugYearAlias(name, year, extra));
    try {
      const row = await create({ url, alias });
      out.push({ ...slot, url, alias: row.alias, urlId: row.id });
    } catch {
      out.push({ ...slot, url, alias });
    }
  }
  return out;
}
