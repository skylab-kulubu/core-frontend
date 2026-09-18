import {
  DEFAULT_MAIL_ORIGIN,
  eventMailComposeHref,
  eventMailListHref,
  mailOrigin,
  openEventMail,
} from './event-mail';

describe('event mail skymail links', () => {
  const original = process.env.NEXT_PUBLIC_MAIL_URL;
  const listId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_MAIL_URL;
    else process.env.NEXT_PUBLIC_MAIL_URL = original;
  });

  it('defaults the Skymail origin when the public env is empty', () => {
    expect(mailOrigin('')).toBe(DEFAULT_MAIL_ORIGIN);
    expect(mailOrigin('   ')).toBe(DEFAULT_MAIL_ORIGIN);
    expect(mailOrigin(undefined)).toBe('https://mail.yildizskylab.com');
    process.env.NEXT_PUBLIC_MAIL_URL = '';
    expect(eventMailComposeHref(listId)).toBe(
      'https://mail.yildizskylab.com/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });

  it('opens skymail compose with the Event mailing list', () => {
    expect(eventMailComposeHref(listId)).toBe(
      'https://mail.yildizskylab.com/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });

  it('opens the skymail list show page for that Event', () => {
    expect(eventMailListHref(listId)).toBe(
      'https://mail.yildizskylab.com/mailing-lists/show/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });

  it('uses the public mail origin when set', () => {
    process.env.NEXT_PUBLIC_MAIL_URL = 'https://mail.example.test/';
    expect(eventMailComposeHref(listId)).toBe(
      'https://mail.example.test/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });

  it('syncs the Event list then opens Skymail compose for that list', async () => {
    const opened: string[] = [];
    await openEventMail(
      'e1',
      async () => ({
        mailListId: listId,
        name: 'WEBLAB SkyDays',
        recipientCount: 2,
      }),
      (href) => {
        opened.push(href);
      },
    );
    expect(opened).toEqual([
      'https://mail.yildizskylab.com/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ]);
  });
});
