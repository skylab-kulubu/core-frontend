export const DEFAULT_MAIL_ORIGIN = 'https://mail.yildizskylab.com';

export function mailOrigin(env = process.env.NEXT_PUBLIC_MAIL_URL): string {
  return (env ?? '').trim().replace(/\/+$/, '') || DEFAULT_MAIL_ORIGIN;
}

export function eventMailHref(
  event: { name?: string; ownerTeam?: string },
  origin = mailOrigin(),
): string {
  const url = new URL(`${origin.replace(/\/+$/, '')}/mailing-lists/create`);
  const name = [event.ownerTeam?.trim(), event.name?.trim()].filter(Boolean).join(' ');
  if (name) url.searchParams.set('name', name);
  return url.toString();
}
