import type { EditableSite } from '@/lib/api/capabilities';
import type { SidebarNavLink } from '@/lib/navigation/sidebar-types';

/**
 * The "Siteyi düzenle" links: each site the person may edit opens its editor
 * sign-in, `<url>/api/signin`, which goes through the Keycloak session (no
 * second password). The addresses come from core's CMS_SITES, so sandbox and
 * production each link their own sites. Only a hint: the CMS decides edits.
 */
export function siteEditLinks(sites: readonly EditableSite[] | undefined): SidebarNavLink[] {
  return (sites ?? []).flatMap((site) => {
    const base = site.url.replace(/\/+$/, '');
    return /^https?:\/\/[^/]/.test(base) ? [{ href: `${base}/api/signin`, label: site.name }] : [];
  });
}
