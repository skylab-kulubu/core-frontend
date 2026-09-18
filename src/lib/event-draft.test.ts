import { emptyEventForm } from '@/components/scheduling/EventEditor';
import type { CoreEvent } from '@/lib/api/events';
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
  ensureReservedEventId,
  eventDraftStorageKey,
  eventIdForForms,
  eventIdFromHref,
  formStateFromEvent,
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

  it('hydrates an existing event from GET JSON even if an empty :new draft is stored', () => {
    const storage = memoryStorage();
    const getJson: CoreEvent = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'SkyDays',
      description: 'Kamp',
      location: 'YTÜ Davutpaşa',
      ownerTeam: 'GECEKODU',
      formUrl: 'https://forms.yildizskylab.com/form-1',
      formAlias: 'gecekodu.skydays2026',
      extraFormUrls: [{ label: 'CTF', url: 'https://forms.yildizskylab.com/ctf' }],
      capacity: 120,
      startDate: '2026-05-01T09:00:00.000Z',
      endDate: '2026-05-02T18:00:00.000Z',
      linkedin: 'https://linkedin.com/company/skylab',
      active: true,
      ranked: true,
      prizeInfo: 'Ödül',
      seasonId: 'season-1',
      coverImageId: 'img-1',
      images: [{ id: 'img-2' }],
      attendanceRule: 'ratio',
      attendanceRatio: 0.75,
      doorStaffIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    writeEventDraft(storage, 'https://admin.yildizskylab.com/events/new', emptyEventForm());
    writeEventDraft(
      storage,
      `https://admin.yildizskylab.com/events/${getJson.id}`,
      emptyEventForm(),
    );
    const loaded = formStateFromEvent(getJson);
    const restored = restoreEventEditor(
      storage,
      `https://admin.yildizskylab.com/events/${getJson.id}`,
      loaded,
      null,
    );
    expect(restored.name).toBe(getJson.name);
    expect(restored.description).toBe(getJson.description);
    expect(restored.location).toBe(getJson.location);
    expect(restored.ownerTeam).toBe(getJson.ownerTeam);
    expect(restored.formUrl).toBe(getJson.formUrl);
    expect(restored.formAlias).toBe(getJson.formAlias);
    expect(restored.capacity).toBe(getJson.capacity);
    expect(restored.prizeInfo).toBe(getJson.prizeInfo);
    expect(restored.coverImageId).toBe(getJson.coverImageId);
    expect(restored.imageIds).toEqual(['img-2']);
    expect(restored.seasonId).toBe(getJson.seasonId);
    expect(restored.doorStaffIds).toEqual(getJson.doorStaffIds);
    expect(restored.formSlots[0]).toMatchObject({
      url: getJson.formUrl,
      alias: getJson.formAlias,
    });
  });

  it('keeps GET fields when Skyforms returns onto an existing event with an empty draft', () => {
    const storage = memoryStorage();
    const eventHref =
      'https://admin.yildizskylab.com/events/11111111-1111-4111-8111-111111111111?formSlot=apply';
    writeEventDraft(storage, 'https://admin.yildizskylab.com/events/new', emptyEventForm());
    writeEventDraft(storage, eventHref, emptyEventForm());
    const loaded = {
      ...emptyEventForm('GECEKODU'),
      name: 'SkyDays',
      location: 'YTÜ Davutpaşa',
      description: 'Kamp',
      formSlots: [{ ...emptyApplySlot(), url: '' }],
    };
    const restored = restoreEventEditor(
      storage,
      `${eventHref}&formUrl=https://forms.yildizskylab.com/form-1`,
      loaded,
      {
        formUrl: 'https://forms.yildizskylab.com/form-1',
        formSlot: APPLY_SLOT_KEY,
      },
    );
    expect(restored.name).toBe('SkyDays');
    expect(restored.location).toBe('YTÜ Davutpaşa');
    expect(restored.description).toBe('Kamp');
    expect(restored.formSlots[0]).toMatchObject({
      key: APPLY_SLOT_KEY,
      url: 'https://forms.yildizskylab.com/form-1',
      mode: 'skyforms',
    });
  });

  it('does not share the :new draft key with /events/{id}', () => {
    const storage = memoryStorage();
    writeEventDraft(storage, 'https://admin.yildizskylab.com/events/new', emptyEventForm());
    const loaded = { ...emptyEventForm('WEBLAB'), name: 'Hack', location: 'YTÜ' };
    const restored = restoreEventEditor(
      storage,
      'https://admin.yildizskylab.com/events/e1',
      loaded,
      null,
    );
    expect(eventIdFromHref('https://admin.yildizskylab.com/events/e1')).toBe('e1');
    expect(eventDraftStorageKey('https://admin.yildizskylab.com/events/e1')).toBe(
      `${EVENT_DRAFT_PREFIX}:e1`,
    );
    expect(restored.name).toBe('Hack');
    expect(restored.location).toBe('YTÜ');
  });

  it('stores a reserved Event id on a new editor so Skyforms can keep it before save', () => {
    const storage = memoryStorage();
    const reserved = '11111111-1111-4111-8111-111111111111';
    const returnTo = 'https://admin.yildizskylab.com/events/new?formSlot=apply';
    writeEventDraft(storage, returnTo, {
      ...emptyEventForm('GECEKODU'),
      name: 'SkyDays',
      reservedId: reserved,
    });
    const restored = restoreEventEditor(storage, returnTo, emptyEventForm(), null);
    expect(restored.reservedId).toBe(reserved);
    expect(eventIdForForms(returnTo, restored.reservedId)).toBe(reserved);
    expect(eventIdFromHref(returnTo)).toBeNull();
    expect(
      skyformsCreateHref(DEFAULT_FORMS_ADMIN_ORIGIN, editorReturnTo(returnTo), {
        title: 'GECEKODU SkyDays 2026',
        ownerTeam: 'GECEKODU',
        eventId: eventIdForForms(returnTo, restored.reservedId),
      }),
    ).toBe(
      'https://forms.yildizskylab.com/admin/forms/new-form?returnTo=https%3A%2F%2Fadmin.yildizskylab.com%2Fevents%2Fnew%3FformSlot%3Dapply&title=GECEKODU+SkyDays+2026&ownerTeam=GECEKODU&eventId=11111111-1111-4111-8111-111111111111',
    );
  });

  it('keeps the same reserved Event id when the new editor is restored twice', () => {
    const first = ensureReservedEventId(
      emptyEventForm('GECEKODU'),
      () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(first.reservedId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(
      ensureReservedEventId(first, () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb').reservedId,
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('prefers a saved Event path over the reserved id', () => {
    expect(
      eventIdForForms(
        'https://admin.yildizskylab.com/events/11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    ).toBe('11111111-1111-4111-8111-111111111111');
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
