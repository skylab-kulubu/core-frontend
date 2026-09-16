import { isPrivileged } from '@/lib/auth/groups';
import type { UserDto } from '@/types/api';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

export type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

const IDENTITY_LINKS: readonly SidebarNavLink[] = [
  { href: '/users', label: 'Kullanıcılar' },
  { href: '/groups', label: 'Gruplar' },
];

export function filterSidebarNavForUser(user: UserDto): SidebarNavLink[] {
  const groups = user.groups ?? [];
  if (isPrivileged(groups)) {
    return [...IDENTITY_LINKS];
  }
  return [];
}
