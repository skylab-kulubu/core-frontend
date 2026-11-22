import { groupTrail, monthChange, rolesByApp, teamGroups } from './user-directory';

const group = (path: string) => ({
  id: path,
  name: path.split('/').pop() ?? '',
  path,
  attributes: {},
});

it('keeps the teams two levels under /UYELER', () => {
  const teams = teamGroups([
    group('/YK'),
    group('/UYELER'),
    group('/UYELER/ARGE'),
    group('/UYELER/ARGE/WEBLAB'),
    group('/UYELER/ARGE/AI-LAB'),
    group('/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'),
  ]);
  expect(teams.map((team) => team.name)).toEqual(['AI-LAB', 'WEBLAB']);
});

it('splits a path into its names', () => {
  expect(groupTrail('/UYELER/ARGE/WEBLAB')).toEqual(['UYELER', 'ARGE', 'WEBLAB']);
});

it('groups roles by application, once each', () => {
  expect(
    rolesByApp([
      { clientId: 'skymail', role: 'send' },
      { clientId: 'core', role: 'events:write' },
      { clientId: 'skymail', role: 'approve' },
      { clientId: 'skymail', role: 'send' },
    ]),
  ).toEqual([
    { app: 'core', roles: ['events:write'] },
    { app: 'skymail', roles: ['approve', 'send'] },
  ]);
});

it('compares this month with the last', () => {
  expect(
    monthChange([
      { month: '2026-10', count: 20 },
      { month: '2026-11', count: 25 },
    ]),
  ).toEqual({ current: 25, previous: 20, change: 25, year: 45 });
  expect(monthChange([{ month: '2026-11', count: 3 }]).change).toBeNull();
});
