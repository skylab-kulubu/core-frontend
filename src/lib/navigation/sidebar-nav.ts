import { canUseUrls, isLeader, isPrivileged } from '@/lib/auth/groups';
import type { UserDto } from '@/types/api';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

export type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

const IDENTITY_LINKS: readonly SidebarNavLink[] = [
  { href: '/dashboard', label: 'Özet' },
  { href: '/users', label: 'Kullanıcılar' },
  { href: '/groups', label: 'Gruplar' },
];

const NEWS_LINKS: readonly SidebarNavLink[] = [{ href: '/announcements', label: 'Duyurular' }];

const LEADER_SCHEDULING_LINKS: readonly SidebarNavLink[] = [
  { href: '/dashboard', label: 'Özet' },
  { href: '/events', label: 'Etkinlikler' },
  { href: '/sessions', label: 'Oturumlar' },
  { href: '/qr', label: 'QR' },
  { href: '/competitors', label: 'Yarışmacılar' },
  { href: '/media', label: 'Medya' },
];

const PRIVILEGED_SCHEDULING_LINKS: readonly SidebarNavLink[] = [
  { href: '/events', label: 'Etkinlikler' },
  { href: '/seasons', label: 'Sezonlar' },
  { href: '/sessions', label: 'Oturumlar' },
  { href: '/event-types', label: 'Etkinlik tipleri' },
  { href: '/qr', label: 'QR' },
  { href: '/competitors', label: 'Yarışmacılar' },
  { href: '/media', label: 'Medya' },
];

const URLS_LINK: SidebarNavLink = { href: '/urls', label: 'Kısa URL' };

function withUrls(
  links: readonly SidebarNavLink[],
  groups: readonly string[],
  roles: readonly string[],
) {
  return canUseUrls(groups, roles) ? [...links, URLS_LINK] : [...links];
}

export function filterSidebarNavForUser(user: UserDto): SidebarNavLink[] {
  const groups = user.groups ?? [];
  const roles = user.roles ?? [];
  if (isPrivileged(groups)) {
    return withUrls(
      [...IDENTITY_LINKS, ...NEWS_LINKS, ...PRIVILEGED_SCHEDULING_LINKS],
      groups,
      roles,
    );
  }
  if (isLeader(groups)) {
    return withUrls(LEADER_SCHEDULING_LINKS, groups, roles);
  }
  if (canUseUrls(groups, roles)) {
    return [{ href: '/dashboard', label: 'Özet' }, URLS_LINK];
  }
  return [];
}
