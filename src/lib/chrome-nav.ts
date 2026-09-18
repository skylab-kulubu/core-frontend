import type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

export type ChromeNavSection = Readonly<{
  label: string | null;
  items: SidebarNavLink[];
}>;

const PLATFORM_HREFS = new Set(['/users', '/groups', '/announcements', '/urls']);
const PROGRAM_HREFS = new Set([
  '/events',
  '/seasons',
  '/sessions',
  '/teams',
  '/qr',
  '/competitors',
  '/media',
]);

export function groupSidebarNav(links: readonly SidebarNavLink[]): ChromeNavSection[] {
  const top: SidebarNavLink[] = [];
  const platform: SidebarNavLink[] = [];
  const program: SidebarNavLink[] = [];
  const rest: SidebarNavLink[] = [];
  for (const link of links) {
    if (link.href === '/dashboard') top.push(link);
    else if (PLATFORM_HREFS.has(link.href)) platform.push(link);
    else if (PROGRAM_HREFS.has(link.href)) program.push(link);
    else rest.push(link);
  }
  const sections: ChromeNavSection[] = [];
  if (top.length) sections.push({ label: null, items: top });
  if (platform.length) sections.push({ label: 'Platform', items: platform });
  if (program.length) sections.push({ label: 'Program', items: program });
  if (rest.length) sections.push({ label: null, items: rest });
  return sections;
}
