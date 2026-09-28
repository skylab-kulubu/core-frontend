import {
  APPLY_SLOT_KEY,
  APPLY_SLOT_LABEL,
  DEFAULT_FORMS_ADMIN_ORIGIN,
  aliasFallbacks,
  aliasYear,
  applyFormHandoff,
  attachFormAliases,
  createAliasWithRetry,
  defaultSlotAlias,
  emptyApplySlot,
  extraFormSlot,
  existingShortFor,
  eventFormTitle,
  formHandoffFromSearch,
  formsAdminOrigin,
  humanFormAlias,
  persistableFormFields,
  shortAliasFromSlug,
  skyformsCreateHref,
  skyformsEditHref,
  skyformsFormId,
  slotAlias,
  slugYearAlias,
  slotsFromEvent,
  withFormSlot,
  type EventFormSlot,
} from './event-forms';
import { ProblemError } from './api/core';
import type { ShortUrl, ShortUrlBody } from './api/urls';

describe('event form slots', () => {
  it('keeps başvuru as the first slot', () => {
    const slots = slotsFromEvent({
      formUrl: 'https://forms.example.test/apply',
      formAlias: 'skydays2026',
      extraFormUrls: [
        { label: 'CTF', url: 'https://forms.example.test/ctf', alias: 'skydays-ctf2026' },
      ],
    });
    expect(slots[0]).toMatchObject({
      key: 'apply',
      label: APPLY_SLOT_LABEL,
      url: 'https://forms.example.test/apply',
      alias: 'skydays2026',
    });
    expect(slots[1]).toMatchObject({
      label: 'CTF',
      url: 'https://forms.example.test/ctf',
      alias: 'skydays-ctf2026',
    });
  });

  it('writes formUrl as the public başvuru link and extras separately', () => {
    const persist = persistableFormFields([
      { ...emptyApplySlot(), url: 'https://apply.example.test', alias: 'jam2026' },
      {
        key: 'extra-1',
        label: 'Yarışma',
        mode: 'external',
        url: 'https://race.example.test',
        alias: 'jam-yarisma2026',
      },
    ]);
    expect(persist.formUrl).toBe('https://apply.example.test');
    expect(persist.formAlias).toBe('jam2026');
    expect(persist.extraFormUrls).toEqual([
      { label: 'Yarışma', url: 'https://race.example.test', alias: 'jam-yarisma2026' },
    ]);
  });

  it('builds slug+year without inventing a form id', () => {
    expect(slugYearAlias('Skydays', 2026)).toBe('skydays2026');
    expect(slugYearAlias('Yıldız Jam', 2026, 'CTF')).toBe('yildiz-jam-ctf2026');
  });

  it('prefers a human ekip.ad year slug and hyphenates for skyl.app', () => {
    expect(humanFormAlias('GECEKODU', 'SkyDays', 2026)).toBe('gecekodu.skydays2026');
    expect(shortAliasFromSlug('gecekodu.skydays')).toBe('gecekodu-skydays');
  });

  it('reads the year from datetime-local', () => {
    expect(aliasYear('2027-03-01T10:00')).toBe(2027);
    expect(aliasYear('', new Date('2026-09-18T00:00:00Z'))).toBe(2026);
  });

  it('defaults skyforms admin origin to the club forms console', () => {
    expect(formsAdminOrigin('')).toBe(DEFAULT_FORMS_ADMIN_ORIGIN);
    expect(formsAdminOrigin(undefined)).toBe(DEFAULT_FORMS_ADMIN_ORIGIN);
    expect(formsAdminOrigin('https://forms.example.test/admin/')).toBe(
      'https://forms.example.test/admin',
    );
    expect(skyformsCreateHref('', 'https://admin.example.test/events/e1')).toBeNull();
    expect(
      skyformsCreateHref(
        DEFAULT_FORMS_ADMIN_ORIGIN,
        withFormSlot('https://admin.yildizskylab.com/events/e1', APPLY_SLOT_KEY),
        { title: 'GECEKODU SkyDays 2026', ownerTeam: 'GECEKODU' },
      ),
    ).toBe(
      'https://forms.yildizskylab.com/admin/forms/new-form?returnTo=https%3A%2F%2Fadmin.yildizskylab.com%2Fevents%2Fe1%3FformSlot%3Dapply&title=GECEKODU+SkyDays+2026&ownerTeam=GECEKODU',
    );
    expect(
      skyformsEditHref(
        DEFAULT_FORMS_ADMIN_ORIGIN,
        '11111111-1111-4111-8111-111111111111',
        'https://admin.yildizskylab.com/events/e1?formSlot=apply',
      ),
    ).toBe(
      'https://forms.yildizskylab.com/admin/forms/11111111-1111-4111-8111-111111111111/edit?returnTo=https%3A%2F%2Fadmin.yildizskylab.com%2Fevents%2Fe1%3FformSlot%3Dapply',
    );
    expect(
      skyformsFormId('https://forms.yildizskylab.com/11111111-1111-4111-8111-111111111111'),
    ).toBe('11111111-1111-4111-8111-111111111111');
    expect(eventFormTitle('GECEKODU', 'SkyDays', 2026)).toBe('GECEKODU SkyDays 2026');
    expect(aliasFallbacks('gecekodu-skydays2026', 2026)).toEqual([
      'gecekodu-skydays2026-2026',
      'gecekodu-skydays2026-2',
      'gecekodu-skydays2026-3',
      'gecekodu-skydays2026-4',
      'gecekodu-skydays2026-5',
      'gecekodu-skydays2026-6',
      'gecekodu-skydays2026-7',
      'gecekodu-skydays2026-8',
      'gecekodu-skydays2026-9',
    ]);
  });

  it('applies a returned skyforms url onto the named slot', () => {
    const search = new URLSearchParams(
      'formUrl=https://forms.yildizskylab.com/form-1&formSlot=extra-ctf',
    );
    expect(formHandoffFromSearch(search)).toEqual({
      formUrl: 'https://forms.yildizskylab.com/form-1',
      formSlot: 'extra-ctf',
    });
    expect(formHandoffFromSearch(new URLSearchParams('formUrl=not-a-url'))).toBeNull();
    const slots = applyFormHandoff([emptyApplySlot(), extraFormSlot('CTF', 'extra-ctf')], {
      formUrl: 'https://forms.yildizskylab.com/form-1',
      formSlot: 'extra-ctf',
    });
    expect(slots[0].url).toBe('');
    expect(slots[1]).toMatchObject({
      key: 'extra-ctf',
      url: 'https://forms.yildizskylab.com/form-1',
      mode: 'skyforms',
    });
  });

  it('matches an existing short row by alias or destination', () => {
    const row = {
      id: 'u1',
      alias: 'skydays2026',
      url: 'https://apply.example.test',
      clickCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(existingShortFor('https://apply.example.test', '', [row])?.id).toBe('u1');
    expect(existingShortFor('', 'skydays2026', [row])?.id).toBe('u1');
  });

  it('creates a short alias only when the destination is set', async () => {
    const created = await attachFormAliases(
      [
        { ...emptyApplySlot(), url: 'https://apply.example.test' },
        extraFormSlot('CTF', 'extra-ctf'),
      ],
      'Skydays',
      '2026-04-01T10:00',
      {
        create: async (body) => ({
          id: 'u2',
          alias: body.alias ?? 'x',
          url: body.url,
          clickCount: 0,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }),
        update: jest.fn(),
        listMine: jest.fn(),
      },
    );
    expect(created[0]).toMatchObject({
      url: 'https://apply.example.test',
      alias: 'skydays2026',
      urlId: 'u2',
    });
    expect(created[1].urlId).toBeUndefined();
  });

  it('retries a conflicting alias with a suffix', async () => {
    const seen: string[] = [];
    const row = await createAliasWithRetry(
      async (body) => {
        seen.push(body.alias ?? '');
        if (body.alias === 'skydays2026') {
          throw new ProblemError(409, 'Conflict');
        }
        return {
          id: 'u3',
          alias: body.alias ?? 'x',
          url: body.url,
          clickCount: 0,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        };
      },
      'https://apply.example.test',
      'skydays2026',
      2026,
    );
    expect(seen[0]).toBe('skydays2026');
    expect(row.alias).toBe('skydays2026-2026');
  });
});

describe('form short links when an Event is saved', () => {
  const FORM_ID = '22222222-2222-4222-8222-222222222222';
  const SKYFORMS_URL = `https://forms.yildizskylab.com/${FORM_ID}`;

  /** A saved Event: a Skyforms başvuru form and an external CTF form, both with their links. */
  const savedEvent = {
    formUrl: SKYFORMS_URL,
    formAlias: 'gecekodu-skydays2026',
    extraFormUrls: [{ label: 'CTF', url: 'https://ctf.example.test', alias: 'skydays-ctf2026' }],
  };

  function shortUrl(partial: Partial<ShortUrl>): ShortUrl {
    return {
      id: 'u-new',
      alias: 'x',
      url: 'https://example.test',
      clickCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...partial,
    };
  }

  /**
   * Core behind the panel's Short link calls: creating an `existing` alias
   * answers 409, `mine` is the caller's own list, and `updateError` makes
   * every rename or retarget fail.
   */
  function fakeCore({
    existing = [] as string[],
    mine = [] as ShortUrl[],
    updateError = undefined as unknown,
  } = {}) {
    return {
      create: jest.fn(async (body: ShortUrlBody) => {
        if (existing.includes(body.alias ?? '')) throw new ProblemError(409, 'Conflict');
        return shortUrl({ alias: body.alias ?? 'x', url: body.url });
      }),
      update: jest.fn(async (id: string, body: ShortUrlBody) => {
        if (updateError) throw updateError;
        return shortUrl({ id, alias: body.alias ?? 'x', url: body.url });
      }),
      listMine: jest.fn(async () => mine),
    };
  }

  function save(slots: EventFormSlot[], core: ReturnType<typeof fakeCore>) {
    return attachFormAliases(slots, 'SkyDays', '2026-05-01T09:00', core, 'GECEKODU');
  }

  it('remembers the link each slot was loaded with', () => {
    const [apply, ctf] = slotsFromEvent(savedEvent);
    expect(apply.saved).toEqual({ alias: 'gecekodu-skydays2026', url: SKYFORMS_URL });
    expect(ctf.saved).toEqual({ alias: 'skydays-ctf2026', url: 'https://ctf.example.test' });
    const [bare] = slotsFromEvent({ formUrl: 'https://apply.example.test' });
    expect(bare.saved).toBeUndefined();
  });

  it('re-saving a loaded Event keeps its aliases and only checks the external link once', async () => {
    const core = fakeCore({ existing: ['gecekodu-skydays2026', 'skydays-ctf2026'] });

    const slots = await save(slotsFromEvent(savedEvent), core);

    expect(persistableFormFields(slots)).toEqual({
      formUrl: SKYFORMS_URL,
      formAlias: 'gecekodu-skydays2026',
      extraFormUrls: [{ label: 'CTF', url: 'https://ctf.example.test', alias: 'skydays-ctf2026' }],
    });
    expect(core.create.mock.calls).toEqual([
      [{ url: 'https://ctf.example.test', alias: 'skydays-ctf2026' }],
    ]);
    expect(slots[1].urlId).toBeUndefined();
  });

  it('recreates a missing external link under its saved alias', async () => {
    const core = fakeCore();

    const slots = await save(slotsFromEvent(savedEvent), core);

    expect(core.create.mock.calls).toEqual([
      [{ url: 'https://ctf.example.test', alias: 'skydays-ctf2026' }],
    ]);
    expect(slots[1]).toMatchObject({ alias: 'skydays-ctf2026', urlId: 'u-new' });
  });

  it('only names the alias of a Skyforms form; core creates its link with the Event', async () => {
    const core = fakeCore();

    const slots = await save(
      [
        { ...emptyApplySlot(), mode: 'skyforms', url: SKYFORMS_URL },
        {
          ...extraFormSlot('CTF', 'extra-ctf'),
          mode: 'skyforms',
          url: 'https://forms.yildizskylab.com/33333333-3333-4333-8333-333333333333',
          alias: 'gecekodu.ctf final',
        },
      ],
      core,
    );

    expect(core.create).not.toHaveBeenCalled();
    expect(core.update).not.toHaveBeenCalled();
    expect(slots[0]).toMatchObject({ url: SKYFORMS_URL, alias: 'gecekodu-skydays2026' });
    expect(slots[0].urlId).toBeUndefined();
    expect(slots[1].alias).toBe('gecekodu-ctf-final');
  });

  it('gives a slot switched from an external URL to a Skyforms form the readable default alias', async () => {
    const core = fakeCore();
    const [apply] = slotsFromEvent({
      formUrl: 'https://apply.example.test',
      formAlias: 'skydays',
    });

    const slots = await save([{ ...apply, mode: 'skyforms', url: SKYFORMS_URL }], core);

    expect(slots[0].alias).toBe('gecekodu-skydays2026');
    expect(core.create).not.toHaveBeenCalled();
    expect(core.update).not.toHaveBeenCalled();
  });

  it('keeps an alias typed for the switched slot, and the saved one while it names the same form', () => {
    const [apply] = slotsFromEvent({ formUrl: 'https://apply.example.test', formAlias: 'skydays' });
    const switched = { ...apply, mode: 'skyforms' as const, url: SKYFORMS_URL };
    expect(slotAlias(switched, 'GECEKODU', 'SkyDays', 2026)).toBe('gecekodu-skydays2026');
    expect(slotAlias({ ...switched, alias: 'kamp.basvuru' }, 'GECEKODU', 'SkyDays', 2026)).toBe(
      'kamp-basvuru',
    );
    const [skyforms] = slotsFromEvent({ formUrl: SKYFORMS_URL, formAlias: 'skydays' });
    const sameForm = { ...skyforms, url: `${SKYFORMS_URL}?utm_source=ig` };
    expect(slotAlias(sameForm, 'GECEKODU', 'SkyDays', 2026)).toBe('skydays');
  });

  it('suggests the readable default hyphenated for skyl.app', () => {
    expect(defaultSlotAlias(emptyApplySlot(), 'GECEKODU', 'SkyDays', 2026)).toBe(
      'gecekodu-skydays2026',
    );
    expect(defaultSlotAlias(extraFormSlot('CTF', 'extra-ctf'), 'GECEKODU', 'SkyDays', 2026)).toBe(
      'gecekodu-skydaysctf2026',
    );
  });

  it('creates a link for a new alias on an external slot', async () => {
    const core = fakeCore({ existing: ['gecekodu-skydays2026', 'skydays-ctf2026'] });
    const [apply, ctf] = slotsFromEvent(savedEvent);

    const slots = await save([apply, { ...ctf, alias: 'ctf-final' }], core);

    expect(core.create.mock.calls).toEqual([
      [{ url: 'https://ctf.example.test', alias: 'ctf-final' }],
    ]);
    expect(slots[1]).toMatchObject({ alias: 'ctf-final', urlId: 'u-new' });
    expect(slots[0].alias).toBe('gecekodu-skydays2026');
  });

  it('points the existing personal link somewhere new when only the external URL changed', async () => {
    const core = fakeCore({
      existing: ['skydays-ctf2026'],
      mine: [shortUrl({ id: 'u-ctf', alias: 'skydays-ctf2026', url: 'https://ctf.example.test' })],
    });
    const [apply, ctf] = slotsFromEvent(savedEvent);

    const slots = await save([apply, { ...ctf, url: 'https://ctf2.example.test' }], core);

    expect(core.update).toHaveBeenCalledWith('u-ctf', {
      url: 'https://ctf2.example.test',
      alias: 'skydays-ctf2026',
    });
    expect(core.create).not.toHaveBeenCalled();
    expect(slots[1]).toMatchObject({
      url: 'https://ctf2.example.test',
      alias: 'skydays-ctf2026',
      urlId: 'u-ctf',
    });
  });

  it.each([
    ['is not among the caller’s links', []],
    [
      'is a Form’s link',
      [
        {
          id: 'u-ctf',
          alias: 'skydays-ctf2026',
          url: 'https://ctf.example.test',
          formId: FORM_ID,
          clickCount: 0,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    ],
  ])('creates a numbered link when the old link %s', async (_case, mine: ShortUrl[]) => {
    const core = fakeCore({ existing: ['skydays-ctf2026'], mine });
    const [apply, ctf] = slotsFromEvent(savedEvent);

    const slots = await save([apply, { ...ctf, url: 'https://ctf2.example.test' }], core);

    expect(core.update).not.toHaveBeenCalled();
    expect(slots[1]).toMatchObject({
      url: 'https://ctf2.example.test',
      alias: 'skydays-ctf2026-2026',
      urlId: 'u-new',
    });
  });

  it('creates a numbered link when moving the old link fails', async () => {
    const core = fakeCore({
      existing: ['skydays-ctf2026'],
      mine: [shortUrl({ id: 'u-ctf', alias: 'skydays-ctf2026', url: 'https://ctf.example.test' })],
      updateError: new ProblemError(403, 'Forbidden'),
    });
    const [apply, ctf] = slotsFromEvent(savedEvent);

    const slots = await save([apply, { ...ctf, url: 'https://ctf2.example.test' }], core);

    expect(core.update).toHaveBeenCalledTimes(1);
    expect(slots[1]).toMatchObject({ alias: 'skydays-ctf2026-2026', urlId: 'u-new' });
  });

  it('keeps creating links for a new Event with an external form', async () => {
    const core = fakeCore();

    const slots = await save([{ ...emptyApplySlot(), url: 'https://apply.example.test' }], core);

    expect(core.create).toHaveBeenCalledWith({
      url: 'https://apply.example.test',
      alias: 'gecekodu-skydays2026',
    });
    expect(core.listMine).not.toHaveBeenCalled();
    expect(slots[0]).toMatchObject({ alias: 'gecekodu-skydays2026', urlId: 'u-new' });
  });
});
