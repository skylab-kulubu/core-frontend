import { isLeader, isPrivileged } from '@/lib/auth/groups';
import type { UserDto } from '@/types/api';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

export type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

const IDENTITY_LINKS: readonly SidebarNavLink[] = [
  { href: '/users', label: 'Kullanıcılar' },
  { href: '/groups', label: 'Gruplar' },
];

const NEWS_LINKS: readonly SidebarNavLink[] = [{ href: '/announcements', label: 'Duyurular' }];

const LEADER_SCHEDULING_LINKS: readonly SidebarNavLink[] = [
  { href: '/events', label: 'Etkinlikler' },
  { href: '/sessions', label: 'Oturumlar' },
  { href: '/qr', label: 'QR' },
];

const PRIVILEGED_SCHEDULING_LINKS: readonly SidebarNavLink[] = [
  { href: '/events', label: 'Etkinlikler' },
  { href: '/seasons', label: 'Sezonlar' },
  { href: '/sessions', label: 'Oturumlar' },
  { href: '/event-types', label: 'Etkinlik tipleri' },
  { href: '/qr', label: 'QR' },
];

export function filterSidebarNavForUser(user: UserDto): SidebarNavLink[] {
  const groups = user.groups ?? [];
  if (isPrivileged(groups)) {
    return [...IDENTITY_LINKS, ...NEWS_LINKS, ...PRIVILEGED_SCHEDULING_LINKS];
  }
  if (isLeader(groups)) {
    return [...LEADER_SCHEDULING_LINKS];
  }
  return [];
}
