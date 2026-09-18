import { eventMailHref } from './event-mail';

describe('event mail stub', () => {
  const original = process.env.NEXT_PUBLIC_MAIL_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_MAIL_URL;
    else process.env.NEXT_PUBLIC_MAIL_URL = original;
  });

  it('opens skymail mailing-list create with the Event name', () => {
    expect(eventMailHref({ name: 'SkyDays', ownerTeam: 'GECEKODU' })).toBe(
      'https://mail.yildizskylab.com/mailing-lists/create?name=GECEKODU+SkyDays',
    );
  });

  it('uses the public mail origin when set', () => {
    process.env.NEXT_PUBLIC_MAIL_URL = 'https://mail.example.test/';
    expect(eventMailHref({ name: 'Hack' })).toBe(
      'https://mail.example.test/mailing-lists/create?name=Hack',
    );
  });
});
