import { filterSidebarNavForUser } from './navigation/sidebar-nav';
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
