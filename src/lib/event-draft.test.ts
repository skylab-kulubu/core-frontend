import { emptyEventForm } from '@/components/scheduling/EventEditor';
import {
  APPLY_SLOT_KEY,
  DEFAULT_FORMS_ADMIN_ORIGIN,
  emptyApplySlot,
  extraFormSlot,
  skyformsCreateHref,
  withFormSlot,
} from './event-forms';
import {
  EVENT_DRAFT_PREFIX,
  clearEventDraft,
  editorReturnTo,
  eventDraftStorageKey,
  eventIdFromHref,
  readEventDraft,
  restoreEventEditor,
  writeEventDraft,
} from './event-draft';

function memoryStorage() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
    removeItem: (key: string) => {
      bag.delete(key);
    },
  };
}

describe('event editor draft', () => {
  it('keys unsaved editors as new and saved ones by event id', () => {
    expect(eventIdFromHref('https://admin.yildizskylab.com/events')).toBeNull();
    expect(eventIdFromHref('https://admin.yildizskylab.com/events/new?formSlot=apply')).toBeNull();
    expect(
      eventIdFromHref(
        'https://admin.yildizskylab.com/events/11111111-1111-4111-8111-111111111111?formSlot=apply',
      ),
    ).toBe('11111111-1111-4111-8111-111111111111');
    expect(eventDraftStorageKey('https://admin.yildizskylab.com/events?formUrl=https://x')).toBe(
      `${EVENT_DRAFT_PREFIX}:new`,
    );
    expect(eventDraftStorageKey('https://admin.yildizskylab.com/events/new?formSlot=apply')).toBe(
      `${EVENT_DRAFT_PREFIX}:new`,
    );
  });

  it('sends Skyforms back to /events/new instead of the list', () => {
    expect(editorReturnTo('https://admin.yildizskylab.com/events', APPLY_SLOT_KEY)).toBe(
      'https://admin.yildizskylab.com/events/new?formSlot=apply',
    );
    expect(
      editorReturnTo('https://admin.yildizskylab.com/events?ownerTeam=GECEKODU', 'extra-ctf'),
    ).toBe('https://admin.yildizskylab.com/events/new?formSlot=extra-ctf');
    expect(
      editorReturnTo(
        'https://admin.yildizskylab.com/events/11111111-1111-4111-8111-111111111111?formUrl=https://forms.yildizskylab.com/x',
        APPLY_SLOT_KEY,
      ),
    ).toBe(
      'https://admin.yildizskylab.com/events/11111111-1111-4111-8111-111111111111?formSlot=apply',
    );
  });

  it('restores typed fields and writes the returned form url into the slot', () => {
    const storage = memoryStorage();
    const returnTo = 'https://admin.yildizskylab.com/events/new?formSlot=apply';
    writeEventDraft(storage, returnTo, {
      ...emptyEventForm('GECEKODU'),
      name: 'SkyDays',
      location: 'YTÜ Davutpaşa',
      description: 'Başvuru',
      formSlots: [{ ...emptyApplySlot(), mode: 'skyforms' }, extraFormSlot('CTF', 'extra-ctf')],
    });
    const restored = restoreEventEditor(
      storage,
      `${returnTo}&formUrl=https://forms.yildizskylab.com/form-1`,
      emptyEventForm(),
      {
        formUrl: 'https://forms.yildizskylab.com/form-1',
        formSlot: APPLY_SLOT_KEY,
      },
    );
    expect(restored.name).toBe('SkyDays');
    expect(restored.location).toBe('YTÜ Davutpaşa');
    expect(restored.description).toBe('Başvuru');
    expect(restored.ownerTeam).toBe('GECEKODU');
    expect(restored.formSlots[0]).toMatchObject({
      key: APPLY_SLOT_KEY,
      url: 'https://forms.yildizskylab.com/form-1',
      mode: 'skyforms',
    });
    expect(readEventDraft(storage, 'https://admin.yildizskylab.com/events')?.name).toBe('SkyDays');
    clearEventDraft(storage, returnTo);
    expect(readEventDraft(storage, returnTo)).toBeNull();
  });

  it('passes event id on the Skyforms create url when the event already exists', () => {
    expect(
      skyformsCreateHref(
        DEFAULT_FORMS_ADMIN_ORIGIN,
        withFormSlot(
          'https://admin.yildizskylab.com/events/11111111-1111-4111-8111-111111111111',
          APPLY_SLOT_KEY,
        ),
        {
          title: 'GECEKODU SkyDays 2026',
          ownerTeam: 'GECEKODU',
          eventId: '11111111-1111-4111-8111-111111111111',
        },
      ),
    ).toBe(
      'https://forms.yildizskylab.com/admin/forms/new-form?returnTo=https%3A%2F%2Fadmin.yildizskylab.com%2Fevents%2F11111111-1111-4111-8111-111111111111%3FformSlot%3Dapply&title=GECEKODU+SkyDays+2026&ownerTeam=GECEKODU&eventId=11111111-1111-4111-8111-111111111111',
    );
  });
});
