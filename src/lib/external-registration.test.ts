/** @jest-environment node */

import { externalRegistrationIssue } from '@/lib/external-registration';
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
