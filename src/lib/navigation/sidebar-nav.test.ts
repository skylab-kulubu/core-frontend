import { buildSidebarNavigation, filterSidebarNavForUser, searchPages } from './sidebar-nav';
import type { SidebarNavigationContext } from './sidebar-nav';
import type { UserDto } from '@/types/api';

const person = (groups: string[], roles: string[] = []): UserDto => ({
  id: groups.join(',') || 'nobody',
  username: 'deneme',
  email: 'deneme@example.com',
  firstName: 'D',
  lastName: 'E',
  roles,
  groups,
});

/** What core answers ADMIN and YK: every menu that follows core's decisions. */
const CORE_PRIVILEGED: SidebarNavigationContext = {
  appsVisible: true,
  subjectRequestsVisible: true,
  mapRegionsVisible: true,
};

function shape(user: UserDto, context: SidebarNavigationContext = {}) {
  return buildSidebarNavigation(user, context).map((node) =>
    node.kind === 'link' ? node.label : [node.label, node.children.map((item) => item.label)],
  );
}

describe('buildSidebarNavigation', () => {
  it('puts the day’s work on top and every setting in Ayarlar at the foot (ADMIN)', () => {
    expect(shape(person(['/ADMIN']), CORE_PRIVILEGED)).toEqual([
      'Özet',
      'Etkinlikler',
      ['Kişiler', ['Kullanıcılar', 'Gruplar', 'KVKK başvuruları']],
      ['İçerik', ['Duyurular', 'Kısa link']],
      [
        'Ayarlar',
        [
          'Sezonlar',
          'Sertifika şablonları',
          'Sertifika yazı tipleri',
          'Sertifika varsayılanları',
          'Uygulamalar',
          "SkyApp'ten geçiş",
          'Harita bölgeleri',
        ],
      ],
    ]);
  });

  it('gives YK the map regions core lets it manage, but not the SkyApp handoff', () => {
    const settings = buildSidebarNavigation(person(['/UYELER/YK']), CORE_PRIVILEGED).at(-1);
    if (settings?.kind !== 'group') throw new Error('settings missing');
    expect(settings.children.map((item) => item.href)).toContain('/map-regions');
    expect(settings.children.map((item) => item.href)).not.toContain('/handoff-targets');
  });

  it('shows DK no menu that core would refuse it', () => {
    // core answers DK (a reader) apps.read, and false for the KVKK register and media writes
    const links = filterSidebarNavForUser(person(['/UYELER/DK']), { appsVisible: true });
    const hrefs = links.map((link) => link.href);
    expect(hrefs).not.toContain('/map-regions');
    expect(hrefs).not.toContain('/handoff-targets');
    expect(hrefs).not.toContain('/subject-requests');
    // Creating events is an action on the events page, never a menu link
    expect(hrefs).not.toContain('/events/new');
  });

  it('keeps an event’s pages out of the sidebar: they are its tabs', () => {
    const hrefs = filterSidebarNavForUser(person(['/ADMIN']), CORE_PRIVILEGED).map(
      (link) => link.href,
    );
    expect(hrefs.filter((href) => href.startsWith('/events'))).toEqual(['/events']);
    expect(hrefs).not.toContain('/qr');
  });

  it('gives each destination one place', () => {
    const hrefs = filterSidebarNavForUser(person(['/ADMIN']), {
      ...CORE_PRIVILEGED,
      managedTeamsVisible: true,
      hasDoorAssignment: true,
    }).map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('gives a Leader the events, their teams and the certificate settings', () => {
    expect(
      shape(person(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']), { managedTeamsVisible: true }),
    ).toEqual([
      'Özet',
      'Etkinlikler',
      ['Kişiler', ['Ekibim']],
      ['Ayarlar', ['Sertifika şablonları', 'Sertifika yazı tipleri', 'Sertifika varsayılanları']],
    ]);
  });

  it('gives door staff the door as their one way in', () => {
    expect(shape(person(['/UYELER/ARGE/WEBLAB']), { hasDoorAssignment: true })).toEqual(['Kapı']);
    expect(shape(person(['/UYELER/ARGE/WEBLAB']))).toEqual([]);
  });

  it('gives a url-only member Özet and Kısa URL', () => {
    expect(shape(person(['/UYELER/ARGE/WEBLAB'], ['url:access']))).toEqual([
      'Özet',
      ['İçerik', ['Kısa link']],
    ]);
  });

  it('lists the menus core decides only once core says so', () => {
    const hrefs = (context: SidebarNavigationContext) =>
      filterSidebarNavForUser(person(['/UYELER/YK']), context).map((link) => link.href);
    for (const href of ['/apps', '/subject-requests', '/map-regions']) {
      expect(hrefs({})).not.toContain(href);
    }
    expect(hrefs({ appsVisible: true })).toContain('/apps');
    expect(hrefs({ subjectRequestsVisible: true })).toContain('/subject-requests');
    expect(hrefs({ mapRegionsVisible: true })).toContain('/map-regions');
  });

  it('gives one teams item: Gruplar to ADMIN and YK, Ekibim to a Leader (DK too)', () => {
    const yk = filterSidebarNavForUser(person(['/UYELER/YK']), { managedTeamsVisible: true });
    expect(yk.map((link) => link.href)).toContain('/groups');
    expect(yk.map((link) => link.href)).not.toContain('/teams');
    expect(yk.map((link) => link.href)).not.toContain('/my-teams');
    const leader = (context: SidebarNavigationContext) =>
      filterSidebarNavForUser(person(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']), context).map(
        (link) => link.href,
      );
    expect(leader({})).not.toContain('/my-teams');
    // DK reads Gruplar too, but a DK member who leads a team keeps their own item
    const dkLeader = filterSidebarNavForUser(
      person(['/DK', '/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']),
      { managedTeamsVisible: true },
    ).map((link) => link.href);
    expect(dkLeader).toContain('/my-teams');
    expect(leader({ managedTeamsVisible: true })).toContain('/my-teams');
  });

  it('lists Dönem devri under Kişiler once core says the person reads Groups or leads a Team', () => {
    const hrefs = (context: SidebarNavigationContext) =>
      filterSidebarNavForUser(person(['/UYELER/YK']), context).map((link) => link.href);
    expect(hrefs({})).not.toContain('/management-memberships');
    expect(hrefs({ managementTermsVisible: true })).toContain('/management-memberships');
  });

  it('leaves certificate issuing to the event tab: no certificate settings for an issuer', () => {
    const hrefs = filterSidebarNavForUser(
      person(['/UYELER/ORGANIZASYON/GECEKODU'], ['certificate:issue', 'certificate:revoke']),
    ).map((link) => link.href);
    expect(hrefs.some((href) => href.startsWith('/certificates'))).toBe(false);
  });

  it('offers a template manager the templates and only a binder the defaults', () => {
    const hrefs = (roles: string[]) =>
      filterSidebarNavForUser(person(['/UYELER/ARGE/WEBLAB'], roles)).map((link) => link.href);
    expect(hrefs(['certificate:template:manage'])).toEqual([
      '/certificates/templates',
      '/certificates/fonts',
    ]);
    expect(hrefs(['certificate:binding:manage'])).toEqual([
      '/certificates/templates',
      '/certificates/defaults',
    ]);
  });
});

describe('searchPages', () => {
  it('adds the door to Ctrl+K for whoever has a door to staff', () => {
    const pages = searchPages(person(['/UYELER/YK']), { hasDoorAssignment: true });
    expect(pages.slice(0, 3).map((page) => page.href)).toEqual(['/dashboard', '/events', '/qr']);
    expect(pages.find((page) => page.href === '/seasons')?.section).toBe('Ayarlar');
  });

  it('leaves the door out for whoever has none, DK included', () => {
    expect(searchPages(person(['/UYELER/DK'])).map((page) => page.href)).not.toContain('/qr');
  });

  it('keeps the door once for door staff and leaves it out for everyone else', () => {
    const staff = searchPages(person(['/UYELER/ARGE/WEBLAB']), { hasDoorAssignment: true });
    expect(staff.map((page) => page.href)).toEqual(['/qr']);
    expect(searchPages(person(['/UYELER/ARGE/WEBLAB'], ['url:access'])).map((p) => p.href)).toEqual(
      ['/dashboard', '/urls'],
    );
  });

  it('finds Kısa link by its old name, url', () => {
    const urls = searchPages(person(['/UYELER/ARGE/WEBLAB'], ['url:access'])).find(
      (page) => page.href === '/urls',
    );
    expect(urls?.label).toBe('Kısa link');
    expect(urls?.keywords).toMatch(/\burl\b/);
  });
});
