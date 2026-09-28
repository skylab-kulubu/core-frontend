import { ProblemError } from '@/lib/api/core';
import type { ShortUrl, ShortUrlBody, urlsApi } from '@/lib/api/urls';
import { isManaged, isManagedRefusal } from '@/lib/short-links';

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
  /** The Short link the panel created for this slot while editing. */
  urlId?: string;
  /**
   * The alias and address the slot had when its Event was loaded: the link
   * the Event already has, which a re-save must keep rather than duplicate.
   */
  saved?: SavedSlotLink;
};

export type SavedSlotLink = { alias: string; url: string };

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

export function skyformsCreateHref(
  origin: string,
  returnTo: string,
  extras?: { title?: string; ownerTeam?: string; eventId?: string },
): string | null {
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const url = new URL(`${trimmed}/forms/new-form`);
  if (returnTo) url.searchParams.set('returnTo', returnTo);
  if (extras?.title) url.searchParams.set('title', extras.title);
  if (extras?.ownerTeam) url.searchParams.set('ownerTeam', extras.ownerTeam);
  if (extras?.eventId) url.searchParams.set('eventId', extras.eventId);
  return url.toString();
}

export function skyformsEditHref(origin: string, formId: string, returnTo: string): string | null {
  const trimmed = origin.trim().replace(/\/+$/, '');
  const id = formId.trim();
  if (!trimmed || !id) return null;
  const url = new URL(`${trimmed}/forms/${id}/edit`);
  if (returnTo) url.searchParams.set('returnTo', returnTo);
  return url.toString();
}

export function skyformsFormId(url: string, origin = formsAdminOrigin()): string | null {
  if (!looksLikeSkyforms(url, origin)) return null;
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean);
    const id = path[0] ?? '';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

export function eventFormTitle(ownerTeam: string, name: string, year: number, extra = ''): string {
  const head = [ownerTeam.trim(), name.trim(), year || ''].filter(Boolean).join(' ');
  const slot = extra.trim();
  if (head && slot) return `${head} ${slot}`;
  return head || slot || 'Etkinlik formu';
}

export function aliasFallbacks(alias: string, year: number): string[] {
  const base = shortAliasFromSlug(alias);
  const seen = new Set<string>(base ? [base] : []);
  const out: string[] = [];
  const push = (value: string) => {
    const next = shortAliasFromSlug(value);
    if (!next || seen.has(next)) return;
    seen.add(next);
    out.push(next);
  };
  const yearText = String(year);
  if (base && !base.includes(yearText)) push(`${base}${yearText}`);
  if (base) push(`${base}-${yearText}`);
  for (let i = 2; i <= 9; i += 1) {
    if (base) push(`${base}-${i}`);
  }
  return out;
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
  return [apply, ...extras].map(rememberSavedLink);
}

function rememberSavedLink(slot: EventFormSlot): EventFormSlot {
  if (!slot.alias) return slot;
  return { ...slot, saved: { alias: slot.alias, url: slot.url } };
}

/**
 * Whether the address is a Skyforms Form's. Core binds that Form's link to
 * the Event that names it on save, under the alias the Event gives it, so the
 * panel never creates or renames such a link itself.
 */
export function namesSkyformsForm(url: string, origin?: string): boolean {
  return skyformsFormId(url.trim(), origin) !== null;
}

/** What a slot adds to its Event's name in titles and aliases: nothing for başvuru, else its label. */
export function slotExtra(slot: Pick<EventFormSlot, 'key' | 'label'>): string {
  return slot.key === APPLY_SLOT_KEY ? '' : slot.label;
}

/** The slot's readable default alias (ekip-ad+year), hyphenated for skyl.app. */
export function defaultSlotAlias(
  slot: Pick<EventFormSlot, 'key' | 'label'>,
  ownerTeam: string,
  name: string,
  year: number,
): string {
  const extra = slotExtra(slot);
  return shortAliasFromSlug(
    humanFormAlias(ownerTeam, name, year, extra) || slugYearAlias(name, year, extra),
  );
}

/**
 * Whether the slot still carries the alias it was loaded with although it
 * now names another Skyforms Form. That alias is a link to the old page, so
 * core would refuse it for the new Form; the slot takes the default instead.
 */
export function savedAliasIsStale(slot: EventFormSlot): boolean {
  if (!slot.saved || slot.alias.trim() !== slot.saved.alias) return false;
  const formId = skyformsFormId(slot.url.trim());
  return formId !== null && formId !== skyformsFormId(slot.saved.url.trim());
}

/**
 * The skyl.app alias the slot is saved with: the typed one, else (or when it
 * is a stale saved alias) the readable default.
 */
export function slotAlias(
  slot: EventFormSlot,
  ownerTeam: string,
  name: string,
  year: number,
): string {
  const typed = savedAliasIsStale(slot) ? '' : shortAliasFromSlug(slot.alias.trim());
  return typed || defaultSlotAlias(slot, ownerTeam, name, year);
}

/** Whether the slot still names the link it was loaded with: same alias, same address. */
export function keepsSavedLink(slot: EventFormSlot, alias: string): boolean {
  return (
    slot.saved !== undefined &&
    alias === slot.saved.alias &&
    slot.url.trim() === slot.saved.url.trim()
  );
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

export async function createAliasWithRetry(
  create: (body: ShortUrlBody) => Promise<ShortUrl>,
  url: string,
  alias: string,
  year: number,
): Promise<ShortUrl> {
  const first = shortAliasFromSlug(alias);
  const candidates = first
    ? [first, ...aliasFallbacks(first, year)]
    : aliasFallbacks('etkinlik', year);
  let last: unknown;
  for (const candidate of candidates) {
    try {
      return await create({ url, alias: candidate });
    } catch (err) {
      last = err;
      if (!(err instanceof ProblemError) || err.status !== 409) throw err;
    }
  }
  throw last instanceof Error ? last : new ProblemError(409, 'Conflict');
}

/** The Short link calls a slot's link needs; `urlsApi` in the app. */
export type SlotLinkApi = Pick<typeof urlsApi, 'create' | 'update' | 'listMine'>;

/**
 * What making a slot's link gave. `linked`: the link now exists under the
 * alias (created, renamed or pointed at the slot's address). `exists`: the
 * Event's link was already there. `createdOnSave`: a Skyforms Form's link,
 * which core makes when the Event is saved. `appliedOnSave`: core refused a
 * rename because an Event or a Form manages the link.
 */
export type SlotLinkResult =
  | { status: 'linked'; alias: string; urlId: string }
  | { status: 'exists' | 'createdOnSave' | 'appliedOnSave'; alias: string };

/**
 * Makes the slot's link under `alias` where the panel owns it. A Skyforms
 * Form's link is left to core. An external slot renames the link it created
 * while editing; keeps the Event's link, creating it once if it went missing;
 * moves the Event's personal link when only the address changed; and
 * otherwise creates a new link, numbered when the alias is taken.
 */
export async function linkSlot(
  slot: EventFormSlot,
  alias: string,
  year: number,
  api: SlotLinkApi,
): Promise<SlotLinkResult> {
  const url = slot.url.trim();
  if (namesSkyformsForm(url)) {
    return { status: keepsSavedLink(slot, alias) ? 'exists' : 'createdOnSave', alias };
  }
  try {
    if (slot.urlId) return linked(await api.update(slot.urlId, { url, alias }));
    if (slot.saved?.alias === alias) {
      if (keepsSavedLink(slot, alias)) return await recreateSavedLink(api, url, alias);
      const moved = await moveSavedLink(api, url, alias);
      if (moved) return moved;
    }
    return linked(await createAliasWithRetry((body) => api.create(body), url, alias, year));
  } catch (err) {
    if (isManagedRefusal(err)) return { status: 'appliedOnSave', alias };
    throw err;
  }
}

function linked(row: ShortUrl): SlotLinkResult {
  return { status: 'linked', alias: row.alias, urlId: row.id };
}

/** Asks for the Event's own alias once, never a numbered one; 409 means it is there. */
async function recreateSavedLink(
  api: SlotLinkApi,
  url: string,
  alias: string,
): Promise<SlotLinkResult> {
  try {
    return linked(await api.create({ url, alias }));
  } catch (err) {
    if (err instanceof ProblemError && err.status === 409) return { status: 'exists', alias };
    throw err;
  }
}

/**
 * Points the caller's personal link under the Event's alias at the slot's new
 * address. Null when there is no such link or moving it fails, so the caller
 * creates a new one; a managed refusal is passed on.
 */
async function moveSavedLink(
  api: SlotLinkApi,
  url: string,
  alias: string,
): Promise<SlotLinkResult | null> {
  const rows = await api.listMine().catch(() => [] as ShortUrl[]);
  const row = existingShortFor('', alias, rows);
  if (!row || isManaged(row)) return null;
  try {
    return linked(await api.update(row.id, { url, alias }));
  } catch (err) {
    if (isManagedRefusal(err)) throw err;
    return null;
  }
}

/**
 * The slots as the Event is saved with them: each with the alias it is saved
 * under, and the id of the link the save made for it. A slot with a link made
 * while editing keeps it; a failed link leaves the alias as it is.
 */
export async function attachFormAliases(
  slots: EventFormSlot[],
  name: string,
  startLocal: string,
  api: SlotLinkApi,
  ownerTeam = '',
): Promise<EventFormSlot[]> {
  const year = aliasYear(startLocal);
  const out: EventFormSlot[] = [];
  for (const slot of slots) {
    const url = slot.url.trim();
    const next = { ...slot, url };
    if (!url || (slot.urlId && !namesSkyformsForm(url))) {
      out.push(next);
      continue;
    }
    const alias = slotAlias(next, ownerTeam, name, year);
    try {
      const result = await linkSlot(next, alias, year, api);
      out.push({
        ...next,
        alias: result.alias,
        ...(result.status === 'linked' ? { urlId: result.urlId } : {}),
      });
    } catch {
      out.push({ ...next, alias });
    }
  }
  return out;
}
