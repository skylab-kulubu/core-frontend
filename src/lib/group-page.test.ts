import {
  addedDates,
  groupKind,
  groupMenuSections,
  groupSectionHref,
  groupSectionOf,
  groupTitle,
  groupTreeRows,
  memberRole,
  sortMembers,
  termsByPerson,
} from '@/lib/group-page';
import type { TeamAuditRecord } from '@/lib/api/identity';
import type { ManagementTerm } from '@/lib/api/management-memberships';

describe('group pages', () => {
  it('reads the open page from the address, under Gruplar and Ekibim', () => {
    expect(groupSectionOf('/groups/g1')).toBe('overview');
    expect(groupSectionOf('/groups/g1/members')).toBe('members');
    expect(groupSectionOf('/my-teams/g1/leaders')).toBe('leaders');
    expect(groupSectionOf('/groups/g1/olmayan')).toBe('overview');
    expect(groupSectionHref('/my-teams', 'g 1', 'audit')).toBe('/my-teams/g%201/audit');
    expect(groupSectionHref('/groups', 'g1', 'overview')).toBe('/groups/g1');
  });

  it('lists only the pages the reader may open, with their counts', () => {
    const sections = groupMenuSections('/groups', 'g1', {
      leaders: false,
      roles: true,
      audit: false,
      counts: { members: 12, roles: 1 },
    });
    expect(sections.flatMap((section) => section.items.map((item) => item.label))).toEqual([
      'Genel bakış',
      'Üyeler',
      'Uygulama rolleri',
      'Ayarlar',
    ]);
    expect(sections[1]!.items[0]!.badge).toBe(12);
  });

  it('tells a Group’s kind from its path', () => {
    expect(groupKind('/YK')).toBe('management');
    expect(groupKind('/UYELER/DK')).toBe('management');
    expect(groupKind('/UYELER/ARGE/WEBLAB')).toBe('team');
    expect(groupKind('/UYELER/ARGE/WEBLAB/MOBIL')).toBe('subteam');
    expect(groupKind('/UYELER/ARGE/WEBLAB/LIDERLER')).toBe('leaders');
    expect(groupKind('/ROLLER/SKYNOTIFY-OKUR')).toBe('roles');
    expect(groupKind('/UYELER/ARGE')).toBe('area');
    expect(groupTitle({ name: 'WEBLAB', attributes: { display_name_tr: 'Web Lab' } })).toBe(
      'Web Lab',
    );
    expect(groupTitle({ name: 'WEBLAB' })).toBe('WEBLAB');
  });
});

describe('members', () => {
  const ada = { id: 'u-ada', firstName: 'Ada', lastName: 'L', email: 'ada@example.com' };
  const cem = {
    id: 'u-cem',
    firstName: 'Cem',
    lastName: 'D',
    email: 'cem@example.com',
    sourceGroupPath: '/UYELER/ARGE/WEBLAB/KOORDINATORLER',
  };
  const bora = { id: 'u-bora', firstName: 'Bora', lastName: 'K', email: 'bora@example.com' };

  it('takes the role from core’s Leaders first, then the Leader group the person sits in', () => {
    const leaders = [
      { id: 'u-ada', kind: 'KOORDINATORLER' },
      { id: 'u-ada', kind: 'LIDERLER' },
    ];
    expect(memberRole(ada, leaders)).toBe('leader');
    expect(memberRole(cem, [])).toBe('coordinator');
    expect(memberRole(bora, leaders)).toBe('member');
  });

  it('puts the Leaders first, then the Coordinators, then everyone by name', () => {
    const roleOf = (m: { id: string }) =>
      m.id === 'u-cem' ? 'coordinator' : m.id === 'u-bora' ? 'leader' : 'member';
    expect(sortMembers([ada, cem, bora], roleOf).map((m) => m.id)).toEqual([
      'u-bora',
      'u-cem',
      'u-ada',
    ]);
  });

  it('dates an add from the newest successful member.add or leader.add', () => {
    const row = (id: string, action: string, outcome: TeamAuditRecord['outcome'], at: string) =>
      ({
        id,
        action,
        outcome,
        occurredAt: at,
        target: { id: 'u-ada', displayName: 'Ada' },
      }) as TeamAuditRecord;
    const dates = addedDates([
      row('1', 'member.remove', 'ok', '2026-11-20T00:00:00Z'),
      row('2', 'member.add', 'denied', '2026-11-19T00:00:00Z'),
      row('3', 'member.add', 'ok', '2026-11-18T00:00:00Z'),
      row('4', 'member.add', 'ok', '2026-10-01T00:00:00Z'),
    ]);
    expect(dates.get('u-ada')).toBe('2026-11-18T00:00:00Z');
  });

  it('keeps the terms of the Group and its Leader groups, the earliest end for each person', () => {
    const term = (id: string, userId: string, groupId: string, endsAt: string | null) =>
      ({ id, userId, groupId, endsAt }) as ManagementTerm;
    const byPerson = termsByPerson(
      [
        term('t1', 'u-ada', 'g-lid', '2027-06-30T00:00:00Z'),
        term('t2', 'u-ada', 'g1', '2026-12-01T00:00:00Z'),
        term('t3', 'u-cem', 'g-other', '2026-12-01T00:00:00Z'),
      ],
      'g1',
      [{ id: 'u-ada', sourceGroupId: 'g-lid' }],
    );
    expect(byPerson.get('u-ada')?.id).toBe('t2');
    expect(byPerson.has('u-cem')).toBe(false);
  });
});

describe('the Groups tree', () => {
  const g = (path: string) => ({ path });

  it('puts each Group after its parent, one step deeper, and folds the ones under a Group', () => {
    const groups = [g('/UYELER/ARGE/WEBLAB'), g('/YK'), g('/UYELER'), g('/UYELER/ARGE')];
    expect(
      groupTreeRows(groups).map((row) => [row.group.path, row.depth, row.hasChildren]),
    ).toEqual([
      ['/UYELER', 0, true],
      ['/UYELER/ARGE', 1, true],
      ['/UYELER/ARGE/WEBLAB', 2, false],
      ['/YK', 0, false],
    ]);
    expect(groupTreeRows(groups, new Set(['/UYELER'])).map((row) => row.group.path)).toEqual([
      '/UYELER',
      '/YK',
    ]);
  });
});
