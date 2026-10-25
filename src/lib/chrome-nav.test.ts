import { buildSidebarNavigation, filterSidebarNavForUser } from './navigation/sidebar-nav';
import { groupSidebarNav } from './chrome-nav';
import type { UserDto } from '@/types/api';

const privileged: UserDto = {
  id: '1',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'Y',
  lastName: 'K',
  roles: [],
  groups: ['/UYELER/YK'],
};

describe('groupSidebarNav', () => {
  it('keeps every privileged href and groups them', () => {
    const links = filterSidebarNavForUser(privileged);
    const sections = groupSidebarNav(links);
    expect(sections.map((s) => s.label)).toEqual([null, 'Platform', 'Program']);
    const grouped = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(grouped)).toEqual(new Set(links.map((l) => l.href)));
    expect(sections.find((s) => s.label === 'Platform')?.items.map((i) => i.href)).toContain(
      '/urls',
    );
  });
});

describe('buildSidebarNavigation', () => {
  it('turns privileged navigation into shallow task groups', () => {
    const nodes = buildSidebarNavigation(privileged);
    expect(nodes.map((node) => node.label)).toEqual([
      'Özet',
      'Etkinlikler',
      'Kulüp',
      'İçerik',
      'Sertifikalar',
    ]);
    const events = nodes.find((node) => node.label === 'Etkinlikler');
    expect(events?.kind).toBe('group');
    if (events?.kind !== 'group') throw new Error('event group missing');
    expect(events.children.map((item) => [item.label, item.href])).toEqual([
      ['Tümü', '/events'],
      ['Takvim', '/events?view=calendar'],
      ['Yeni', '/events/new'],
      ['Sezonlar', '/seasons'],
      ['Kapı', '/qr'],
    ]);
    const club = nodes.find((node) => node.label === 'Kulüp');
    if (club?.kind !== 'group') throw new Error('club group missing');
    expect(club.children.map((item) => item.href)).toEqual(['/users', '/groups', '/teams']);
    const certificates = nodes.find((node) => node.label === 'Sertifikalar');
    if (certificates?.kind !== 'group') throw new Error('certificate group missing');
    expect(certificates.children.map((item) => item.href)).toEqual([
      '/certificates/templates',
      '/certificates/defaults',
    ]);
  });

  it('lists Uygulamalar in Kulüp only once core says the app assignments are readable', () => {
    const club = (context: { appsVisible?: boolean }) => {
      const node = buildSidebarNavigation(privileged, context).find((row) => row.label === 'Kulüp');
      if (node?.kind !== 'group') throw new Error('club group missing');
      return node.children.map((item) => item.href);
    };
    expect(club({})).toEqual(['/users', '/groups', '/teams']);
    expect(club({ appsVisible: false })).toEqual(['/users', '/groups', '/teams']);
    expect(club({ appsVisible: true })).toEqual(['/users', '/groups', '/apps', '/teams']);
    // A Leader never sees it, whatever the context says
    const leader = filterSidebarNavForUser(
      { ...privileged, id: '3', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] },
      { appsVisible: true },
    );
    expect(leader.map((link) => link.href)).not.toContain('/apps');
  });

  it('lists Ekiplerim in Kulüp only once core names a Team the person leads', () => {
    const leader = { ...privileged, id: '3', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] };
    const club = (context: { managedTeamsVisible?: boolean }) => {
      const node = buildSidebarNavigation(leader, context).find((row) => row.label === 'Kulüp');
      return node?.kind === 'group' ? node.children.map((item) => item.href) : [];
    };
    expect(club({})).toEqual([]);
    expect(club({ managedTeamsVisible: false })).toEqual([]);
    expect(club({ managedTeamsVisible: true })).toEqual(['/my-teams']);
    expect(
      filterSidebarNavForUser(privileged, { managedTeamsVisible: true }).map((link) => link.href),
    ).toContain('/my-teams');
  });

  it('does not emit empty groups for a url-only member', () => {
    const nodes = buildSidebarNavigation({
      ...privileged,
      id: '2',
      groups: ['/UYELER/ARGE/WEBLAB'],
      roles: ['url:create'],
    });
    expect(nodes.map((node) => node.label)).toEqual(['Özet', 'İçerik']);
    const content = nodes[1];
    if (content.kind !== 'group') throw new Error('content group missing');
    expect(content.children.map((item) => item.href)).toEqual(['/urls']);
  });

  it('leaves certificate issuing to the event tab: no Sertifikalar menu for an issuer', () => {
    const nodes = buildSidebarNavigation({
      ...privileged,
      id: '4',
      groups: ['/UYELER/ORGANIZASYON/GECEKODU'],
      roles: ['certificate:issue', 'certificate:revoke'],
    });
    expect(nodes.map((node) => node.label)).not.toContain('Sertifikalar');
  });

  it('does not offer event creation to a GECEKODU member', () => {
    const nodes = buildSidebarNavigation({
      ...privileged,
      id: 'gecekodu-member',
      groups: ['/UYELER/GECEKODU'],
    });
    const events = nodes.find((node) => node.label === 'Etkinlikler');
    if (events?.kind !== 'group') throw new Error('event group missing');
    expect(events.children.map((item) => item.href)).toEqual(['/events', '/events?view=calendar']);
  });

  it('offers SkyApp handoff settings only to the ADMIN group', () => {
    const admin = buildSidebarNavigation({ ...privileged, id: 'admin', groups: ['/ADMIN'] });
    const system = admin.find((node) => node.label === 'Sistem');
    if (system?.kind !== 'group') throw new Error('system group missing');
    expect(system.children).toEqual([{ href: '/handoff-targets', label: "SkyApp'ten geçiş" }]);

    for (const groups of [['/UYELER/YK'], ['/UYELER/DK'], ['/UYELER/ARGE/WEBLAB/LIDERLER']]) {
      const nodes = buildSidebarNavigation({ ...privileged, id: 'other', groups });
      expect(nodes.map((node) => node.label)).not.toContain('Sistem');
    }
  });
});
