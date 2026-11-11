import { ProblemError } from '@/lib/api/core';
import type { ManagedGroup, MovePreview } from '@/lib/api/identity';
import { coreProblemMessage, groupDeleteProblemMessage } from '@/lib/core-problems';
import { flattenManagedGroups, type ManagedGroupRow } from '@/lib/managed-groups';

/** A Team as the panel names it: its Turkish display name, else its code. */
export function teamName(node: Pick<ManagedGroup, 'code' | 'displayName'>): string {
  return node.displayName?.tr?.trim() || node.code;
}

/** Leader group names in the reader's words. */
export function leaderKindLabel(kind: string): string {
  if (kind === 'LIDERLER') return 'Lider';
  if (kind === 'KOORDINATORLER') return 'Koordinatör';
  return kind;
}

/** The managed Team right above `id` in the tree; none for a Team the tree starts at. */
export function managedParentOf(
  nodes: readonly ManagedGroup[],
  id: string,
): ManagedGroup | undefined {
  return flattenManagedGroups(nodes).find(({ group }) =>
    (group.children ?? []).some((child) => child.id === id),
  )?.group;
}

/**
 * Where the reader may move `moving`: the Teams core lets them open
 * Sub-teams under (`subteams.write`), less the Team itself, the Teams under
 * it and the Team it sits under now. core's preview decides each pick.
 */
export function moveTargets(
  nodes: readonly ManagedGroup[],
  moving: ManagedGroup,
): ManagedGroupRow[] {
  const own = new Set(flattenManagedGroups([moving]).map(({ group }) => group.id));
  const parent = managedParentOf(nodes, moving.id)?.id;
  return flattenManagedGroups(nodes).filter(
    ({ group }) =>
      !own.has(group.id) && group.id !== parent && group.can?.['subteams.write'] === true,
  );
}

/** What a move would do, as the confirmation lists it (core's preview). */
export function movePreviewRows(preview: MovePreview): { label: string; value: string }[] {
  const rows = [
    { label: 'Şimdiki yol', value: preview.oldPath },
    { label: 'Yeni yol', value: preview.newPath },
    { label: 'Taşınan kişi', value: String(preview.members) },
  ];
  if (preview.rolesGained.length > 0) {
    rows.push({ label: 'Kazanılan roller', value: preview.rolesGained.join(', ') });
  }
  if (preview.rolesLost.length > 0) {
    rows.push({ label: 'Kaybedilen roller', value: preview.rolesLost.join(', ') });
  }
  rows.push({ label: 'Yeni üst ekibin lideri', value: String(preview.newParentLeaders) });
  return rows;
}

/** core's Team structure refusals (docs/team-delegation.md), in the reader's words. */
const STRUCTURE_MESSAGES: Record<string, string> = {
  invalid_name:
    'Kod 2-24 karakter olmalı: büyük harfle başlar, yalnız büyük harf (A-Z), rakam ve tire içerir (ör. FRONTEND).',
  reserved_name: 'Bu kod ayrılmış; başka bir kod seç.',
  name_taken: 'Bu kod kullanılıyor ya da daha önce kullanıldı; başka bir kod seç.',
  depth_limit: 'Ekip ağacının sınırı aşılırdı: alt ekipler çok derinleşir ya da yol çok uzar.',
  children_limit: 'Ekibin alt ekip sınırı dolu.',
  team_code_privileged_only: 'Ekip kodunu YK değiştirir.',
  protected_group: 'Korunan ekip: yalnız YK değiştirir.',
  leader_group_needs_parent:
    'Bir ekibin liderlerini üst ekibin liderleri ya da YK değiştirir; kendi ekibininkileri değiştiremezsin.',
  group_limit: 'Kişi çok sayıda grupta; bu ekleme yapılamaz.',
  team_code_not_unique: 'Bu ekibin kodu başka bir grupla aynı; yalnız YK değiştirir.',
  protection_unverified: 'Grubun rol koruması doğrulanamadı; biraz sonra tekrar dene.',
  group_tree_mismatch: 'Ekip ağacı değişmiş; sayfayı yenileyip tekrar dene.',
  audit_unavailable: 'Değişiklik kayda yazılamadı, bu yüzden yapılmadı. Biraz sonra tekrar dene.',
};

/** The refusals only a move has (core docs/team-delegation.md "Moving a Team"). */
const MOVE_MESSAGES: Record<string, string> = {
  privileged_root: 'Yönetim kökleri ve altlarındaki gruplar taşınamaz.',
  invalid_move_source: 'Yalnız alt ekipler taşınır.',
  invalid_move_target: 'Ekip yalnız bir ekibin altına taşınır.',
  leader_group_target: 'Lider grubunun altına ekip taşınamaz.',
  cycle: 'Ekip kendi altına taşınamaz.',
  same_parent: 'Ekip zaten bu ekibin altında.',
  role_placement:
    'Taşınırsa ekibin ya da altındaki bir grubun rolleri kurala aykırı bir yere düşerdi.',
};

/** The kinds of core record `code_in_use` names. */
const RECORD_KINDS: Record<string, string> = {
  event: 'etkinlik',
  certificate: 'sertifika',
  certificate_template: 'sertifika şablonu',
  certificate_template_binding: 'sertifika şablonu eşleşmesi',
};

function recordKinds(fields: Record<string, unknown>): string {
  const records = Array.isArray(fields.records) ? fields.records : [];
  return records
    .filter((kind): kind is string => typeof kind === 'string')
    .map((kind) => RECORD_KINDS[kind] ?? kind)
    .join(', ');
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A Turkish sentence for a refused Team structure or Leader write: opening
 * a Sub-team, changing its code, naming or removing a Leader, moving it.
 * Codes the panel already words elsewhere fall back to coreProblemMessage.
 */
export function teamStructureMessage(
  error: unknown,
  fallback: string,
  statusText: Partial<Record<number, string>> = {},
): string {
  if (error instanceof ProblemError && error.code) {
    if (error.code === 'code_in_use') {
      const kinds = recordKinds(error.fields);
      return kinds
        ? `Bu koda bağlı kayıt var (${kinds}); kod değiştirilemez.`
        : 'Bu koda bağlı kayıt var; kod değiştirilemez.';
    }
    if (STRUCTURE_MESSAGES[error.code]) return STRUCTURE_MESSAGES[error.code];
  }
  return coreProblemMessage(error, fallback, statusText);
}

/** Refusals the Group delete already words for a delete (groupDeleteProblemMessage). */
const DELETE_WORDED = new Set([
  'group_delete_protected',
  'privileged_root',
  'protected_group',
  'protection_unverified',
  'group_tree_mismatch',
]);

/** A Turkish sentence for a refused Sub-team delete; the Group delete's words otherwise. */
export function subTeamDeleteMessage(error: unknown): string {
  if (error instanceof ProblemError) {
    if (error.code === 'not_empty') {
      const members = count(error.fields.members);
      const children = count(error.fields.children);
      if (members > 0) {
        return `Alt ekipte ya da altındaki gruplarda ${members} kişi var (liderler dahil); önce onları çıkar.`;
      }
      if (children > 0) return `Alt ekibin altında ${children} grup var; önce onları sil.`;
      return 'Alt ekip boş değil.';
    }
    if (error.code === 'code_in_use') {
      const kinds = recordKinds(error.fields);
      return kinds
        ? `Ekibin ya da altındaki bir grubun koduna bağlı kayıt var (${kinds}); silinemez.`
        : 'Ekibin ya da altındaki bir grubun koduna bağlı kayıt var; silinemez.';
    }
    if (error.code && !DELETE_WORDED.has(error.code) && STRUCTURE_MESSAGES[error.code]) {
      return STRUCTURE_MESSAGES[error.code];
    }
  }
  return groupDeleteProblemMessage(error);
}

/** Why core's preview refuses a move (`refusal`), in the reader's words. */
export function moveRefusalMessage(refusal: string | undefined): string {
  if (!refusal) return 'Bu taşıma yapılamaz.';
  return MOVE_MESSAGES[refusal] ?? STRUCTURE_MESSAGES[refusal] ?? 'Bu taşıma yapılamaz.';
}

/** A Turkish sentence for a refused move or preview read. */
export function moveProblemMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemError && error.code && MOVE_MESSAGES[error.code]) {
    return MOVE_MESSAGES[error.code];
  }
  return teamStructureMessage(error, fallback);
}
