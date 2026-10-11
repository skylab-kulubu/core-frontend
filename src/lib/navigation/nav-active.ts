/**
 * Whether a navigation link points at the current page. Section links (#…) never
 * count; the event list and its calendar view are told apart by `view`.
 */
export function isNavActive(pathname: string, currentSearch: string, href: string): boolean {
  const [hrefWithoutHash, hash = ''] = href.split('#');
  if (hash) return false;
  const [path, wantedSearch = ''] = hrefWithoutHash.split('?');
  if (path === '/events' && pathname !== '/events') return false;
  if (pathname !== path) {
    return path !== '/dashboard' && pathname.startsWith(`${path}/`);
  }
  if (wantedSearch) {
    const current = new URLSearchParams(currentSearch);
    const wanted = new URLSearchParams(wantedSearch);
    return [...wanted].every(([key, value]) => current.get(key) === value);
  }
  if (path === '/events') return !new URLSearchParams(currentSearch).has('view');
  return pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`));
}
