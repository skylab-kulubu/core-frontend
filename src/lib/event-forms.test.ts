import {
  APPLY_SLOT_KEY,
  APPLY_SLOT_LABEL,
  DEFAULT_FORMS_ADMIN_ORIGIN,
  aliasYear,
  applyFormHandoff,
  attachFormAliases,
  emptyApplySlot,
  extraFormSlot,
  existingShortFor,
  formHandoffFromSearch,
  formsAdminOrigin,
  humanFormAlias,
  persistableFormFields,
  shortAliasFromSlug,
  skyformsCreateHref,
  slugYearAlias,
  slotsFromEvent,
  withFormSlot,
} from './event-forms';

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
      ),
    ).toBe(
      'https://forms.yildizskylab.com/admin/forms/new-form?returnTo=https%3A%2F%2Fadmin.yildizskylab.com%2Fevents%2Fe1%3FformSlot%3Dapply',
    );
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
      async (body) => ({
        id: 'u2',
        alias: body.alias ?? 'x',
        url: body.url,
        clickCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    );
    expect(created[0]).toMatchObject({
      url: 'https://apply.example.test',
      alias: 'skydays2026',
      urlId: 'u2',
    });
    expect(created[1].urlId).toBeUndefined();
  });
});
