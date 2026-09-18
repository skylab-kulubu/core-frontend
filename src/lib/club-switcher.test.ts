import { clubSwitcherLinks } from './club-switcher';

describe('clubSwitcherLinks', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('from admin lists Forms and Mail and never Place', () => {
    expect(clubSwitcherLinks('admin')).toEqual([
      {
        id: 'forms',
        label: 'Forms',
        href: 'https://forms.yildizskylab.com/admin',
      },
      {
        id: 'mail',
        label: 'Mail',
        href: 'https://mail.yildizskylab.com',
      },
    ]);
  });

  it('from forms lists Yönetim and Mail', () => {
    expect(clubSwitcherLinks('forms')).toEqual([
      {
        id: 'admin',
        label: 'Yönetim',
        href: 'https://admin.yildizskylab.com',
      },
      {
        id: 'mail',
        label: 'Mail',
        href: 'https://mail.yildizskylab.com',
      },
    ]);
  });

  it('from mail lists Yönetim and Forms', () => {
    expect(clubSwitcherLinks('mail')).toEqual([
      {
        id: 'admin',
        label: 'Yönetim',
        href: 'https://admin.yildizskylab.com',
      },
      {
        id: 'forms',
        label: 'Forms',
        href: 'https://forms.yildizskylab.com/admin',
      },
    ]);
  });

  it('uses public origin env when set', () => {
    process.env.NEXT_PUBLIC_ADMIN_URL = 'https://admin.example.test';
    process.env.NEXT_PUBLIC_FORMS_ADMIN_URL = 'https://forms.example.test/admin';
    process.env.NEXT_PUBLIC_MAIL_URL = 'https://mail.example.test';

    expect(clubSwitcherLinks('admin')).toEqual([
      {
        id: 'forms',
        label: 'Forms',
        href: 'https://forms.example.test/admin',
      },
      {
        id: 'mail',
        label: 'Mail',
        href: 'https://mail.example.test',
      },
    ]);
  });
});
