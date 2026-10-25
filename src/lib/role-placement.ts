/**
 * Where a client role may be mapped (core's role placement rule, rol-temizligi
 * K4): a Privileged root itself, a top Team's Leader group or a role group
 * right under /ROLLER with nothing under it. Anywhere else core refuses a new
 * mapping with 409 `role_placement` and a `reason`; taking a role off is
 * always allowed. The panel reads the same rule only to decide whether it
 * offers "Rol ekle": core decides every request.
 */

/** core's default Privileged roots (AUTHZ_PRIVILEGED_ROOTS unset). */
const PRIVILEGED_ROOTS = ['/ADMIN', '/YK', '/DK', '/UYELER/ADMIN', '/UYELER/YK', '/UYELER/DK'];
const LEADER_SUBGROUPS = ['LIDERLER', 'KOORDINATORLER'];
const MEMBERS_ROOT = '/UYELER';
export const ROLES_ROOT = '/ROLLER';
/** Depth of a Team's own Group: /UYELER/<area>/<team>. */
const MIN_TEAM_DEPTH = 3;

export type RolePlacementReason =
  | 'privileged_subgroup'
  | 'members_root'
  | 'area'
  | 'team'
  | 'sub_team_leader_group'
  | 'roles_root'
  | 'roles_group_not_leaf'
  | 'roles_nested'
  | 'outside_role_places'
  // core ticket 04: a top Team takes app roles only
  | 'top_team_admin_role'
  // core's app assignments (ticket 15, /v1/apps)
  | 'admin_role'
  | 'code_area'
  | 'service_account'
  | 'inactive_user'
  // core's PUT /v1/groups/:id/client-roles with app assignments on
  | 'use_app_assignments';

/** A Turkish sentence for each reason core gives on a refused mapping. */
export const ROLE_PLACEMENT_MESSAGES: Record<RolePlacementReason, string> = {
  privileged_subgroup:
    'Yönetim kökünün altındaki gruplara rol verilmez; rolü kökün kendisine (ör. /UYELER/YK) ver.',
  members_root:
    '/UYELER grubuna rol verilmez: bütün üyeler alırdı. /ROLLER altında bir rol grubu kullan.',
  area: 'Alan grubuna rol verilmez: altındaki bütün ekipler alırdı. /ROLLER altında bir rol grubu kullan.',
  team: 'Ekip ya da alt ekip grubuna rol verilmez; rolü en üst ekibin LIDERLER ya da KOORDINATORLER grubuna ver ya da /ROLLER altında bir rol grubu kullan.',
  sub_team_leader_group:
    'Alt ekibin lider grubuna rol verilmez; yalnız en üst ekibin LIDERLER/KOORDINATORLER grubu rol alır.',
  roles_root:
    '/ROLLER grubunun kendisine rol verilmez; altındaki bir rol grubuna (/ROLLER/<UYGULAMA>-<ROL>) ver.',
  roles_group_not_leaf:
    'Altında grup olan rol grubuna rol verilmez: roller alttaki gruplara da geçerdi.',
  roles_nested: 'Rol grubu doğrudan /ROLLER altında olmalı: /ROLLER/<UYGULAMA>-<ROL>.',
  outside_role_places:
    'Roller yalnız yönetim köküne, en üst ekibin lider grubuna ya da /ROLLER altındaki bir rol grubuna verilir.',
  top_team_admin_role:
    'En üst ekip grubuna yalnız uygulama rolü verilir (ör. Forms koltuğu, SkyMail erişimi). Yönetici rolünü lider grubuna ya da /ROLLER altındaki bir rol grubuna ver.',
  admin_role: 'Panelden yalnız uygulama rolü atanır; yönetici rolleri kodda tanımlıdır.',
  code_area: 'Yönetim kökleri ve /ROLLER kodda tanımlıdır; panelden değiştirilmez.',
  service_account: 'Servis hesaplarının rolleri kodda tanımlıdır.',
  inactive_user: 'Hesap kapalı ya da silinmiş; atama yapılamaz.',
  use_app_assignments: 'Bu grubun uygulama rolleri Uygulamalar sayfasından atanır ve kaldırılır.',
};

const GENERAL_PLACEMENT =
  'Bu gruba rol verilemez. Roller yalnız yönetim köküne, en üst ekibin lider grubuna ya da /ROLLER altındaki bir rol grubuna verilir.';

/** The Turkish sentence for a `role_placement` refusal's reason; an unknown reason gets the rule itself. */
export function rolePlacementMessage(reason: unknown): string {
  return typeof reason === 'string' && reason in ROLE_PLACEMENT_MESSAGES
    ? ROLE_PLACEMENT_MESSAGES[reason as RolePlacementReason]
    : GENERAL_PLACEMENT;
}

function segments(path: string): string[] {
  return path.replace(/^\//, '').split('/');
}

function privilegedRoot(path: string): string {
  return PRIVILEGED_ROOTS.find((root) => path === root || path.startsWith(`${root}/`)) ?? '';
}

/**
 * core's TeamOf: the Team a Group is, or the Team whose Leader group it is
 * (with the Leader group's name), under /UYELER and outside the Privileged roots.
 */
function teamOf(path: string): { team: string; role: string } | null {
  if (!path.startsWith(`${MEMBERS_ROOT}/`) || privilegedRoot(path)) return null;
  const parts = segments(path);
  for (const [i, part] of parts.entries()) {
    if (!part) return null;
    if (LEADER_SUBGROUPS.includes(part) && i !== parts.length - 1) return null;
  }
  let team = path;
  let role = '';
  const last = parts[parts.length - 1];
  if (LEADER_SUBGROUPS.includes(last)) {
    parts.pop();
    team = `/${parts.join('/')}`;
    role = last;
  }
  if (parts.length < MIN_TEAM_DEPTH) return null;
  return { team, role };
}

/**
 * Why core would refuse a new role on the Group at `path`, or null when it
 * takes one. `hasSubgroups` is whether a Group sits under it.
 */
export function rolePlacement(path: string, hasSubgroups: boolean): RolePlacementReason | null {
  const root = privilegedRoot(path);
  if (root) return root === path ? null : 'privileged_subgroup';
  if (path === ROLES_ROOT) return 'roles_root';
  if (path.startsWith(`${ROLES_ROOT}/`)) {
    if (path.slice(ROLES_ROOT.length + 1).includes('/')) return 'roles_nested';
    return hasSubgroups ? 'roles_group_not_leaf' : null;
  }
  if (path === MEMBERS_ROOT) return 'members_root';
  const team = teamOf(path);
  if (team && !team.role) return 'team';
  if (team) return segments(team.team).length === MIN_TEAM_DEPTH ? null : 'sub_team_leader_group';
  const parts = segments(path);
  if (
    path.startsWith(`${MEMBERS_ROOT}/`) &&
    parts.length === 2 &&
    !LEADER_SUBGROUPS.includes(parts[1])
  ) {
    return 'area';
  }
  return 'outside_role_places';
}

/**
 * Why core's app assignments (/v1/apps, core authz.AppAssignmentTarget)
 * would refuse an app role on the Group at `path`, or null when the panel
 * assigns one there: a Team, a Sub-team or a Leader group of either. A
 * Privileged root, /ROLLER and what is under them are code.
 */
export function appAssignmentTarget(path: string): RolePlacementReason | null {
  if (privilegedRoot(path) || path === ROLES_ROOT || path.startsWith(`${ROLES_ROOT}/`)) {
    return 'code_area';
  }
  if (path === MEMBERS_ROOT) return 'members_root';
  if (teamOf(path)) return null;
  const parts = segments(path);
  if (
    path.startsWith(`${MEMBERS_ROOT}/`) &&
    parts.length === 2 &&
    !LEADER_SUBGROUPS.includes(parts[1])
  ) {
    return 'area';
  }
  return 'outside_role_places';
}
