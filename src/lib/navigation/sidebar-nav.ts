import {
  canUseCertificates,
  canUseUrls,
  canWriteEvent,
  isLeader,
  isPrivileged,
} from '@/lib/auth/groups';
import type { UserDto } from '@/types/api';
import type { SidebarNavLink, SidebarNavNode } from '@/lib/navigation/sidebar-types';

export type { SidebarNavLink } from '@/lib/navigation/sidebar-types';
export type { SidebarNavNode } from '@/lib/navigation/sidebar-types';

const URLS_LINK: SidebarNavLink = { href: '/urls', label: 'Kısa URL' };

export type SidebarNavigationContext = Readonly<{
  hasDoorAssignment?: boolean;
  activeEvent?: Readonly<{
    id: string;
    canSeeParticipants: boolean;
    canSeeCompetitors: boolean;
    canUseDoor: boolean;
    canSeeCertificates?: boolean;
  }>;
}>;

type NavigationFacts = Readonly<{
  groups: readonly string[];
  roles: readonly string[];
  privileged: boolean;
  leader: boolean;
  context: SidebarNavigationContext;
}>;

const NAVIGATION_LINKS: ReadonlyArray<
  SidebarNavLink & { visibleWhen: (facts: NavigationFacts) => boolean }
> = [
  {
    href: '/dashboard',
    label: 'Özet',
    visibleWhen: ({ privileged, leader, groups, roles }) =>
      privileged || leader || canUseUrls(groups, roles),
  },
  {
    href: '/users',
    label: 'Kullanıcılar',
    visibleWhen: ({ privileged, roles }) => privileged || roles.includes('users:read'),
  },
  { href: '/groups', label: 'Gruplar', visibleWhen: ({ privileged }) => privileged },
  { href: '/announcements', label: 'Duyurular', visibleWhen: ({ privileged }) => privileged },
  {
    href: '/events',
    label: 'Etkinlikler',
    visibleWhen: ({ privileged, leader, groups }) =>
      privileged || leader || canWriteEvent(groups, 'GECEKODU', 'update'),
  },
  { href: '/seasons', label: 'Sezonlar', visibleWhen: ({ privileged }) => privileged },
  { href: '/teams', label: 'Ekipler', visibleWhen: ({ privileged }) => privileged },
  {
    href: '/qr',
    label: 'Kapı',
    visibleWhen: ({ privileged, leader, context }) =>
      privileged || leader || context.hasDoorAssignment === true,
  },
  {
    href: '/competitors',
    label: 'Yarışmacılar',
    visibleWhen: ({ privileged, leader }) => privileged || leader,
  },
  { href: '/media', label: 'Medya', visibleWhen: ({ privileged, leader }) => privileged || leader },
  {
    ...URLS_LINK,
    visibleWhen: ({ groups, roles }) => canUseUrls(groups, roles),
  },
  {
    href: '/certificates',
    label: 'Sertifikalar',
    visibleWhen: ({ groups, roles }) => canUseCertificates(groups, roles),
  },
];

export function filterSidebarNavForUser(
  user: UserDto,
  context: SidebarNavigationContext = {},
): SidebarNavLink[] {
  const groups = user.groups ?? [];
  const roles = user.roles ?? [];
  const facts: NavigationFacts = {
    groups,
    roles,
    privileged: isPrivileged(groups),
    leader: isLeader(groups),
    context,
  };
  return NAVIGATION_LINKS.filter((item) => item.visibleWhen(facts)).map(({ href, label }) => ({
    href,
    label,
  }));
}

export function buildSidebarNavigation(
  user: UserDto,
  context: SidebarNavigationContext = {},
): SidebarNavNode[] {
  const links = filterSidebarNavForUser(user, context);
  const allowed = new Set(links.map((link) => link.href));
  const nodes: SidebarNavNode[] = [];
  if (allowed.has('/dashboard')) {
    nodes.push({ kind: 'link', href: '/dashboard', label: 'Özet' });
  }

  const eventChildren: SidebarNavLink[] = [];
  if (allowed.has('/events')) {
    eventChildren.push(
      { href: '/events', label: 'Tümü' },
      { href: '/events?view=calendar', label: 'Takvim' },
    );
    if (isPrivileged(user.groups ?? []) || isLeader(user.groups ?? [])) {
      eventChildren.push({ href: '/events/new', label: 'Yeni' });
    }
  }
  for (const item of [
    { href: '/seasons', label: 'Sezonlar' },
    { href: '/qr', label: 'Kapı' },
    { href: '/competitors', label: 'Yarışmacılar' },
  ]) {
    if (allowed.has(item.href)) eventChildren.push(item);
  }
  if (eventChildren.length) {
    nodes.push({ kind: 'group', id: 'events', label: 'Etkinlikler', children: eventChildren });
  }

  if (context.activeEvent) {
    const eventHref = `/events/${encodeURIComponent(context.activeEvent.id)}`;
    const activeEventChildren: SidebarNavLink[] = [
      { href: `${eventHref}#overview`, label: 'Özet' },
      { href: `${eventHref}#program`, label: 'Program' },
    ];
    if (context.activeEvent.canSeeParticipants) {
      activeEventChildren.splice(1, 0, {
        href: `${eventHref}#participants`,
        label: 'Başvuranlar',
      });
    }
    if (context.activeEvent.canSeeCompetitors) {
      activeEventChildren.push({ href: `${eventHref}#competitors`, label: 'Yarışmacılar' });
    }
    if (context.activeEvent.canUseDoor) {
      activeEventChildren.push({
        href: `/qr?eventId=${encodeURIComponent(context.activeEvent.id)}`,
        label: 'Kapı',
      });
    }
    if (context.activeEvent.canSeeCertificates) {
      activeEventChildren.push({ href: `${eventHref}#certificates`, label: 'Sertifikalar' });
    }
    nodes.push({
      kind: 'group',
      id: 'active-event',
      label: 'Aktif Etkinlik',
      children: activeEventChildren,
    });
  }

  const clubChildren = [
    { href: '/users', label: 'Kullanıcılar' },
    { href: '/groups', label: 'Gruplar' },
    { href: '/teams', label: 'Ekipler' },
  ].filter((item) => allowed.has(item.href));
  if (clubChildren.length) {
    nodes.push({ kind: 'group', id: 'club', label: 'Kulüp', children: clubChildren });
  }

  const contentChildren = [
    { href: '/announcements', label: 'Duyurular' },
    { href: '/media', label: 'Medya' },
    { href: '/urls', label: 'Kısa URL' },
  ].filter((item) => allowed.has(item.href));
  if (contentChildren.length) {
    nodes.push({ kind: 'group', id: 'content', label: 'İçerik', children: contentChildren });
  }
  if (allowed.has('/certificates')) {
    const groups = user.groups ?? [];
    const roles = user.roles ?? [];
    const privilegedOrLeader = isPrivileged(groups) || isLeader(groups);
    const certificateChildren: SidebarNavLink[] = [];
    if (
      privilegedOrLeader ||
      roles.includes('certificate:template:manage') ||
      roles.includes('certificate:binding:manage')
    ) {
      certificateChildren.push({ href: '/certificates/templates', label: 'Şablonlar' });
    }
    if (privilegedOrLeader || roles.includes('certificate:binding:manage')) {
      certificateChildren.push({ href: '/certificates/defaults', label: 'Varsayılanlar' });
    }
    if (
      privilegedOrLeader ||
      roles.includes('certificate:issue') ||
      roles.includes('certificate:revoke')
    ) {
      certificateChildren.push({ href: '/certificates/issued', label: 'Verilenler' });
    }
    if (privilegedOrLeader || roles.includes('certificate:issue')) {
      certificateChildren.push({ href: '/certificates/jobs', label: 'Üretim İşleri' });
    }
    nodes.push({
      kind: 'group',
      id: 'certificates',
      label: 'Sertifikalar',
      children: certificateChildren,
    });
  }
  return nodes;
}
