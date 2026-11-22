import { eventTabFromPath } from '@/lib/event-workspace';

/**
 * Whether a navigation link points at the current page. Section links (#…) never
 * count; an event's overview counts on its exact path only, since its other tabs
 * are routes under it, while Etkinlikler stays current on every event page.
 */
export function isNavActive(pathname: string, currentSearch: string, href: string): boolean {
  const [hrefWithoutHash, hash = ''] = href.split('#');
  if (hash) return false;
  const [path, wantedSearch = ''] = hrefWithoutHash.split('?');
  if (eventTabFromPath(path) === 'overview') return pathname === path;
  if (pathname !== path) {
    return path !== '/dashboard' && pathname.startsWith(`${path}/`);
  }
  if (wantedSearch) {
    const current = new URLSearchParams(currentSearch);
    const wanted = new URLSearchParams(wantedSearch);
    return [...wanted].every(([key, value]) => current.get(key) === value);
  }
  return pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`));
}
