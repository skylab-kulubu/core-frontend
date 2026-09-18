import { emptyEventForm, type EventFormState } from '@/components/scheduling/EventEditor';
import {
  APPLY_SLOT_KEY,
  applyFormHandoff,
  emptyApplySlot,
  persistableFormFields,
  withFormSlot,
  type EventFormSlot,
} from '@/lib/event-forms';

export const EVENT_DRAFT_PREFIX = 'superadmin:eventDraft';
const EVENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventDraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function eventIdFromHref(href: string): string | null {
  try {
    const path = new URL(href, 'https://admin.yildizskylab.com').pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'events' || parts.length < 2) return null;
    const id = parts[1];
    if (id === 'new' || !EVENT_ID_RE.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

export function eventDraftStorageKey(returnTo: string): string {
  const id = eventIdFromHref(returnTo);
  return `${EVENT_DRAFT_PREFIX}:${id ?? 'new'}`;
}

export function editorReturnTo(currentHref: string, slotKey = APPLY_SLOT_KEY): string {
  try {
    const url = new URL(currentHref);
    const id = eventIdFromHref(currentHref);
    const path = id ? `/events/${id}` : '/events/new';
    return withFormSlot(`${url.origin}${path}`, slotKey);
  } catch {
    return withFormSlot(currentHref, slotKey);
  }
}

export function writeEventDraft(
  storage: EventDraftStorage | null | undefined,
  returnTo: string,
  draft: EventFormState,
): void {
  if (!storage || !returnTo) return;
  try {
    storage.setItem(eventDraftStorageKey(returnTo), JSON.stringify(draft));
  } catch {
    return;
  }
}

export function readEventDraft(
  storage: EventDraftStorage | null | undefined,
  returnTo: string,
): EventFormState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(eventDraftStorageKey(returnTo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EventFormState> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeDraft(parsed);
  } catch {
    return null;
  }
}

export function clearEventDraft(
  storage: EventDraftStorage | null | undefined,
  returnTo: string,
): void {
  if (!storage) return;
  try {
    storage.removeItem(eventDraftStorageKey(returnTo));
  } catch {
    return;
  }
}

export function restoreEventEditor(
  storage: EventDraftStorage | null | undefined,
  returnTo: string,
  fallback: EventFormState,
  handoff: { formUrl: string; formSlot: string } | null,
): EventFormState {
  const draft = readEventDraft(storage, returnTo) ?? fallback;
  if (!handoff) return draft;
  const base = draft.formSlots?.length ? draft.formSlots : [emptyApplySlot()];
  const formSlots = applyFormHandoff(base, handoff);
  return { ...draft, formSlots, ...persistableFormFields(formSlots) };
}

function normalizeDraft(parsed: Partial<EventFormState>): EventFormState {
  const base = emptyEventForm(typeof parsed.ownerTeam === 'string' ? parsed.ownerTeam : '');
  const formSlots = Array.isArray(parsed.formSlots)
    ? parsed.formSlots.map(normalizeSlot)
    : base.formSlots;
  return {
    ...base,
    ...parsed,
    name: typeof parsed.name === 'string' ? parsed.name : base.name,
    description: typeof parsed.description === 'string' ? parsed.description : base.description,
    location: typeof parsed.location === 'string' ? parsed.location : base.location,
    ownerTeam: typeof parsed.ownerTeam === 'string' ? parsed.ownerTeam : base.ownerTeam,
    formSlots: formSlots.length ? formSlots : [emptyApplySlot()],
    imageIds: Array.isArray(parsed.imageIds)
      ? parsed.imageIds.filter((id) => typeof id === 'string')
      : [],
    doorStaffIds: Array.isArray(parsed.doorStaffIds)
      ? parsed.doorStaffIds.filter((id) => typeof id === 'string')
      : [],
  };
}

function normalizeSlot(slot: Partial<EventFormSlot> | null | undefined): EventFormSlot {
  const fallback = emptyApplySlot();
  return {
    key: typeof slot?.key === 'string' && slot.key ? slot.key : fallback.key,
    label: typeof slot?.label === 'string' && slot.label ? slot.label : fallback.label,
    mode: slot?.mode === 'skyforms' ? 'skyforms' : 'external',
    url: typeof slot?.url === 'string' ? slot.url : '',
    alias: typeof slot?.alias === 'string' ? slot.alias : '',
    urlId: typeof slot?.urlId === 'string' ? slot.urlId : undefined,
  };
}
