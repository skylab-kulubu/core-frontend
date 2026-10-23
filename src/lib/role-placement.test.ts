import {
  ROLE_PLACEMENT_MESSAGES,
  appAssignmentTarget,
  rolePlacement,
  rolePlacementMessage,
  type RolePlacementReason,
} from '@/lib/role-placement';

describe('rolePlacement (core authz.RolePlacement)', () => {
  const cases: Array<[string, boolean, RolePlacementReason | null]> = [
    // Privileged roots themselves take roles; their duty groups do not
    ['/ADMIN', false, null],
    ['/UYELER/YK', true, null],
    ['/UYELER/DK', false, null],
    ['/UYELER/YK/SEKRETER', false, 'privileged_subgroup'],
    // Role groups: a leaf right under /ROLLER
    ['/ROLLER', true, 'roles_root'],
    ['/ROLLER/SKYMAIL-OKUR', false, null],
    ['/ROLLER/SKYMAIL-OKUR', true, 'roles_group_not_leaf'],
    ['/ROLLER/SKYMAIL-OKUR/ALT', false, 'roles_nested'],
    // The members' tree
    ['/UYELER', true, 'members_root'],
    ['/UYELER/ARGE', true, 'area'],
    ['/UYELER/ARGE/WEBLAB', true, 'team'],
    ['/UYELER/ARGE/WEBLAB/FRONTEND', true, 'team'],
    ['/UYELER/ARGE/WEBLAB/LIDERLER', false, null],
    ['/UYELER/ORGANIZASYON/GECEKODU/KOORDINATORLER', false, null],
    ['/UYELER/ARGE/WEBLAB/FRONTEND/LIDERLER', false, 'sub_team_leader_group'],
    ['/UYELER/LIDERLER', false, 'outside_role_places'],
    // Anything else
    ['/SERVICES/FORMS', false, 'outside_role_places'],
  ];

  it.each(cases)('%s (subgroups: %s) → %s', (path, hasSubgroups, reason) => {
    expect(rolePlacement(path, hasSubgroups)).toBe(reason);
  });

  it('has a Turkish sentence for every reason core sends', () => {
    for (const [, , reason] of cases) {
      if (reason) expect(rolePlacementMessage(reason)).toBe(ROLE_PLACEMENT_MESSAGES[reason]);
    }
  });
});

describe('appAssignmentTarget (core authz.AppAssignmentTarget)', () => {
  const cases: Array<[string, RolePlacementReason | null]> = [
    // Teams, Sub-teams and their Leader groups take an app role
    ['/UYELER/ARGE/WEBLAB', null],
    ['/UYELER/ARGE/WEBLAB/LIDERLER', null],
    ['/UYELER/ARGE/WEBLAB/FRONTEND', null],
    ['/UYELER/ARGE/WEBLAB/FRONTEND/LIDERLER', null],
    ['/UYELER/ORGANIZASYON/GECEKODU/KOORDINATORLER', null],
    // The code's places
    ['/ADMIN', 'code_area'],
    ['/UYELER/YK', 'code_area'],
    ['/UYELER/YK/BASKAN', 'code_area'],
    ['/ROLLER', 'code_area'],
    ['/ROLLER/FORMS-ACCESS', 'code_area'],
    // Everyone below
    ['/UYELER', 'members_root'],
    ['/UYELER/ARGE', 'area'],
    ['/UYELER/LIDERLER', 'outside_role_places'],
    ['/KONSOL', 'outside_role_places'],
  ];

  it.each(cases)('%s → %s', (path, reason) => {
    expect(appAssignmentTarget(path)).toBe(reason);
  });

  it('words every reason core sends for an app assignment', () => {
    for (const reason of [
      'top_team_admin_role',
      'admin_role',
      'code_area',
      'service_account',
      'inactive_user',
    ] as const) {
      expect(rolePlacementMessage(reason)).toBe(ROLE_PLACEMENT_MESSAGES[reason]);
    }
  });
});
