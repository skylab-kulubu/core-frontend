export type ClubConsole = 'admin' | 'forms' | 'mail';

export type ClubSwitcherLink = {
  id: ClubConsole;
  label: string;
  href: string;
};

function clubConsoles(): ClubSwitcherLink[] {
  return [
    {
      id: 'admin',
      label: 'Yönetim',
      href: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.yildizskylab.com',
    },
    {
      id: 'forms',
      label: 'Forms',
      href:
        process.env.NEXT_PUBLIC_FORMS_ADMIN_URL ??
        'https://forms.yildizskylab.com/admin',
    },
    {
      id: 'mail',
      label: 'Mail',
      href: process.env.NEXT_PUBLIC_MAIL_URL ?? 'https://mail.yildizskylab.com',
    },
  ];
}

export function clubSwitcherLinks(current: ClubConsole): ClubSwitcherLink[] {
  return clubConsoles().filter((app) => app.id !== current);
}
