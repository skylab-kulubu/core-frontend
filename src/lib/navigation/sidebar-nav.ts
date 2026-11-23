import {
  canManageHandoffTargets,
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

export type SidebarNavigationContext = Readonly<{
  hasDoorAssignment?: boolean;
  /** core's `apps.read`: the app assignments are on and the reader may read them. */
  appsVisible?: boolean;
  /** core's `managedTeams` is not empty: team delegation is on and the reader leads a Team. */
  managedTeamsVisible?: boolean;
  /** core's `subjectRequest.manage`: the KVKK md. 11 register (ADMIN and YK, never DK). */
  subjectRequestsVisible?: boolean;
  /**
   * core's `media.delete`, the media:manage write the map regions are decided by
   * (ADMIN and YK, never DK).
   */
  mapRegionsVisible?: boolean;
  /** "Siteyi düzenle": the editor sign-in of each site the person may edit (external links). */
  editSites?: readonly SidebarNavLink[];
}>;

type NavigationFacts = Readonly<{
  groups: readonly string[];
  roles: readonly string[];
  privileged: boolean;
  leader: boolean;
  context: SidebarNavigationContext;
}>;

type NavigationLink = SidebarNavLink & {
  /** The sidebar group the link sits in; none for a top-level link. */
  section?: 'people' | 'content' | 'settings';
  /** More words Ctrl+K finds the page by, such as its old name. */
  keywords?: string;
  visibleWhen: (facts: NavigationFacts) => boolean;
};

const seesEvents = ({ privileged, leader, groups }: NavigationFacts) =>
  privileged || leader || canWriteEvent(groups, 'GECEKODU', 'update');

/**
 * Every destination of the sidebar, each in one place: the day's work on top
 * (events, people, content) and the settings in one group at the foot. An
 * event's own pages are its tabs, never sidebar links.
 */
const NAVIGATION_LINKS: readonly NavigationLink[] = [
  {
    href: '/dashboard',
    label: 'Özet',
    visibleWhen: ({ privileged, leader, groups, roles }) =>
      privileged || leader || canUseUrls(groups, roles),
  },
  { href: '/events', label: 'Etkinlikler', visibleWhen: seesEvents },
  // Whoever sees the events opens the door from the event; door staff have this one way in
  {
    href: '/qr',
    label: 'Kapı',
    visibleWhen: (facts) => facts.context.hasDoorAssignment === true && !seesEvents(facts),
  },
  {
    href: '/users',
    label: 'Kullanıcılar',
    section: 'people',
    visibleWhen: ({ privileged, roles }) => privileged || roles.includes('users:read'),
  },
  {
    href: '/groups',
    label: 'Gruplar',
    section: 'people',
    visibleWhen: ({ privileged }) => privileged,
  },
  {
    href: '/teams',
    label: 'Ekipler',
    section: 'people',
    visibleWhen: ({ privileged }) => privileged,
  },
  {
    href: '/my-teams',
    label: 'Ekiplerim',
    section: 'people',
    visibleWhen: ({ context }) => context.managedTeamsVisible === true,
  },
  {
    href: '/subject-requests',
    label: 'KVKK başvuruları',
    section: 'people',
    visibleWhen: ({ context }) => context.subjectRequestsVisible === true,
  },
  {
    href: '/announcements',
    label: 'Duyurular',
    section: 'content',
    visibleWhen: ({ privileged }) => privileged,
  },
  {
    href: '/urls',
    label: 'Kısa link',
    section: 'content',
    // Its name until November 2026
    keywords: 'url kısa url',
    visibleWhen: ({ groups, roles }) => canUseUrls(groups, roles),
  },
  {
    href: '/seasons',
    label: 'Sezonlar',
    section: 'settings',
    visibleWhen: ({ privileged }) => privileged,
  },
  {
    href: '/certificates/templates',
    label: 'Sertifika şablonları',
    section: 'settings',
    visibleWhen: ({ groups, roles }) => canUseCertificates(groups, roles),
  },
  {
    href: '/certificates/defaults',
    label: 'Sertifika varsayılanları',
    section: 'settings',
    visibleWhen: ({ privileged, leader, roles }) =>
      privileged || leader || roles.includes('certificate:binding:manage'),
  },
  {
    href: '/apps',
    label: 'Uygulamalar',
    section: 'settings',
    visibleWhen: ({ privileged, context }) => privileged && context.appsVisible === true,
  },
  {
    href: '/handoff-targets',
    label: "SkyApp'ten geçiş",
    section: 'settings',
    visibleWhen: ({ groups }) => canManageHandoffTargets(groups),
  },
  {
    href: '/map-regions',
    label: 'Harita bölgeleri',
    section: 'settings',
    visibleWhen: ({ context }) => context.mapRegionsVisible === true,
  },
];

const SECTION_LABELS = { people: 'Kişiler', content: 'İçerik', settings: 'Ayarlar' } as const;

function visibleLinks(user: UserDto, context: SidebarNavigationContext): NavigationLink[] {
  const groups = user.groups ?? [];
  const roles = user.roles ?? [];
  const facts: NavigationFacts = {
    groups,
    roles,
    privileged: isPrivileged(groups),
    leader: isLeader(groups),
    context,
  };
  return NAVIGATION_LINKS.filter((item) => item.visibleWhen(facts));
}

/** Every page the sidebar offers this person, in its order. */
export function filterSidebarNavForUser(
  user: UserDto,
  context: SidebarNavigationContext = {},
): SidebarNavLink[] {
  return visibleLinks(user, context).map(({ href, label }) => ({ href, label }));
}

/** The sidebar: top-level links first, then Kişiler and İçerik, and Ayarlar at the foot. */
export function buildSidebarNavigation(
  user: UserDto,
  context: SidebarNavigationContext = {},
): SidebarNavNode[] {
  const links = visibleLinks(user, context);
  const nodes: SidebarNavNode[] = links
    .filter((link) => !link.section)
    .map(({ href, label }) => ({ kind: 'link', href, label }));
  for (const section of ['people', 'content', 'settings'] as const) {
    const children = links
      .filter((link) => link.section === section)
      .map(({ href, label }) => ({ href, label }));
    if (children.length) {
      nodes.push({ kind: 'group', id: section, label: SECTION_LABELS[section], children });
    }
  }
  return nodes;
}

/**
 * The pages Ctrl+K opens: the sidebar's, each with its section's name to be
 * found by, and Kapı for whoever has a door to staff (core's door list), the
 * people who also open it from an event included.
 */
export function searchPages(
  user: UserDto,
  context: SidebarNavigationContext = {},
): Array<SidebarNavLink & { section?: string; keywords?: string }> {
  const pages: Array<SidebarNavLink & { section?: string; keywords?: string }> = visibleLinks(
    user,
    context,
  ).map(({ href, label, section, keywords }) => ({
    href,
    label,
    section: section ? SECTION_LABELS[section] : undefined,
    keywords,
  }));
  if (context.hasDoorAssignment === true && !pages.some((page) => page.href === '/qr')) {
    const at = pages.findIndex((page) => page.href === '/events');
    pages.splice(at + 1, 0, { href: '/qr', label: 'Kapı' });
  }
  return pages;
}
