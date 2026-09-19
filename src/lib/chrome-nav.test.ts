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
      ['Yarışmacılar', '/competitors'],
    ]);
    const club = nodes.find((node) => node.label === 'Kulüp');
    if (club?.kind !== 'group') throw new Error('club group missing');
    expect(club.children.map((item) => item.href)).toEqual(['/users', '/groups', '/teams']);
    const certificates = nodes.find((node) => node.label === 'Sertifikalar');
    if (certificates?.kind !== 'group') throw new Error('certificate group missing');
    expect(certificates.children.map((item) => item.href)).toEqual([
      '/certificates/templates',
      '/certificates/defaults',
      '/certificates/issued',
      '/certificates/jobs',
    ]);
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
});
