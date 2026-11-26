/** @jest-environment node */

import {
  externalRegistrationIssue,
  externalRegistrationIssueCode,
  moveSkyformsLink,
  skyformsLinkIn,
  skyformsMoveTarget,
} from '@/lib/external-registration';
import { emptyApplySlot, extraFormSlot } from '@/lib/event-forms';
import { eventFormIssue } from '@/lib/events-view';
import { sectionOfIssue } from '@/components/scheduling/EventEditor';

describe('externalRegistrationIssue', () => {
  it.each(['', '  ', 'https://forms.office.com/r/AbC', 'https://lu.ma/x?y=1'])(
    'takes %j',
    (link) => {
      expect(externalRegistrationIssue(link)).toBeNull();
    },
  );

  it.each([
    'http://forms.office.com/r/x',
    'forms.office.com/r/x',
    'javascript:alert(1)',
    'https://user:pw@forms.office.com/r/x',
    'https://forms.office.com/r/a b',
    `https://example.com/${'a'.repeat(2048)}`,
  ])('refuses %j', (link) => {
    expect(externalRegistrationIssue(link)).toMatch(/Dış kayıt bağlantısı/);
  });

  it('stops the save and points to the Başvuru section', () => {
    const issue = eventFormIssue({
      name: 'Hack',
      location: 'YTÜ',
      externalRegistrationUrl: 'http://x.example.com',
    });
    expect(issue).toMatch(/Dış kayıt bağlantısı/);
    expect(sectionOfIssue(issue!)).toBe('basvuru');
  });
});

describe('externalRegistrationIssueCode', () => {
  it.each([
    ['http://x.example.com', 'not_https'],
    ['https://a b.example.com', 'blank'],
    ['https://u:p@x.example.com', 'credentials'],
    [`https://x.example.com/${'a'.repeat(2048)}`, 'too_long'],
    ['https://x.example.com', null],
  ])('%j → %j', (link, code) => {
    expect(externalRegistrationIssueCode(link)).toBe(code);
  });
});

const FORM = '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b';
const PROD = 'https://forms.yildizskylab.com/admin';

describe('skyformsLinkIn', () => {
  it.each([
    [`https://forms.yildizskylab.com/${FORM}`, `https://forms.yildizskylab.com/${FORM}`],
    [
      `https://forms.yildizskylab.com/admin/forms/${FORM}/edit`,
      `https://forms.yildizskylab.com/${FORM}`,
    ],
    [
      `https://sandbox-forms.yildizskylab.com/${FORM}?x=1`,
      `https://sandbox-forms.yildizskylab.com/${FORM}`,
    ],
  ])('finds the form in %j', (link, formUrl) => {
    expect(skyformsLinkIn(link, PROD)).toEqual({ formId: FORM, formUrl });
  });

  it('knows the configured forms host', () => {
    expect(
      skyformsLinkIn(`https://forms.example.test/${FORM}`, 'https://forms.example.test/admin'),
    ).toEqual({
      formId: FORM,
      formUrl: `https://forms.example.test/${FORM}`,
    });
  });

  it('says a forms address without a form is still Skyforms', () => {
    expect(skyformsLinkIn('https://forms.yildizskylab.com/', PROD)).toEqual({
      formId: null,
      formUrl: null,
    });
  });

  it.each(['', 'https://forms.office.com/r/AbC', `https://lu.ma/${FORM}`, 'nope'])(
    'leaves %j alone',
    (link) => {
      expect(skyformsLinkIn(link, PROD)).toBeNull();
    },
  );
});

describe('moveSkyformsLink', () => {
  const link = { formId: FORM, formUrl: `https://forms.yildizskylab.com/${FORM}` };

  it('fills the empty application slot as a Skyforms form', () => {
    const slots = [emptyApplySlot()];
    expect(skyformsMoveTarget(slots, link, PROD)).toBe('apply');
    const [apply] = moveSkyformsLink(slots, link, PROD);
    expect(apply).toMatchObject({ key: 'apply', url: link.formUrl, mode: 'skyforms' });
  });

  it('adds an extra slot when the application slot has a form', () => {
    const slots = [{ ...emptyApplySlot(), url: 'https://forms.office.com/r/x' }];
    expect(skyformsMoveTarget(slots, link, PROD)).toBe('extra');
    const next = moveSkyformsLink(slots, link, PROD);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ label: 'Ek form', url: link.formUrl, mode: 'skyforms' });
  });

  it('changes nothing when a slot already lists the form', () => {
    const extra = {
      ...extraFormSlot('CTF'),
      url: `https://forms.yildizskylab.com/${FORM.toUpperCase()}`,
    };
    const slots = [emptyApplySlot(), extra];
    expect(skyformsMoveTarget(slots, link, PROD)).toBe('listed');
    expect(moveSkyformsLink(slots, link, PROD)).toEqual(slots);
  });
});
