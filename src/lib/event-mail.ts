export const DEFAULT_MAIL_ORIGIN = 'https://mail.yildizskylab.com';

export function mailOrigin(env = process.env.NEXT_PUBLIC_MAIL_URL): string {
  return (env ?? '').trim().replace(/\/+$/, '') || DEFAULT_MAIL_ORIGIN;
}

export function eventMailComposeHref(mailListId: string, origin = mailOrigin()): string {
  const url = new URL(`${origin.replace(/\/+$/, '')}/mail-tasks/create`);
  url.searchParams.set('mail_list_id', mailListId);
  return url.toString();
}

export function eventMailListHref(mailListId: string, origin = mailOrigin()): string {
  return `${origin.replace(/\/+$/, '')}/mailing-lists/show/${encodeURIComponent(mailListId)}`;
}

export type EventMailSync = (eventId: string) => Promise<{ mailListId: string }>;

export async function openEventMail(
  eventId: string,
  sync: EventMailSync,
  open: (href: string) => void,
): Promise<void> {
  const got = await sync(eventId);
  open(eventMailComposeHref(got.mailListId));
}
