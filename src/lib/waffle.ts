export type WaffleApp = {
  id: 'admin' | 'forms' | 'place';
  label: string;
  href: string;
};

export function waffleApps(): WaffleApp[] {
  return [
    {
      id: 'admin',
      label: 'Yönetim',
      href: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.yildizskylab.com',
    },
    {
      id: 'forms',
      label: 'Forms',
      href: process.env.NEXT_PUBLIC_FORMS_URL ?? 'https://forms.yildizskylab.com',
    },
    {
      id: 'place',
      label: 'Place',
      href: process.env.NEXT_PUBLIC_PLACE_URL ?? 'https://place.yildizskylab.com',
    },
  ];
}

export function waffleAppIsCurrent(href: string, origin: string): boolean {
  try {
    return new URL(href).origin === origin;
  } catch {
    return false;
  }
}
