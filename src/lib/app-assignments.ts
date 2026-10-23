import type { AppAssignment, AppAuditEntry, AppTarget } from '@/lib/api/apps';

const WHEN = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

/** core's RFC 3339 instant as the club reads it (Istanbul). */
export function formatInstant(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : WHEN.format(d);
}

/** The one line the Kişi tab of the add drawer says (Entra: assign to groups first). */
export const PERSON_ASSIGNMENT_HINT = 'Önerilen yol grup; kişiye atama istisnadır.';

/** What a Group's row says about the Groups that inherit its assignment. */
export function inheritText(row: Pick<AppAssignment | AppTarget, 'type' | 'inheritsTo'>): string {
  if (row.type !== 'group' || row.inheritsTo <= 0) return '';
  return `Alt ekipleri de kapsar (${row.inheritsTo} grup)`;
}

/** How many people an assignment reaches. */
export function reachText(row: Pick<AppAssignment | AppTarget, 'members'>): string {
  return `${row.members} kişi`;
}

/** Who made the assignment and when, or why the panel cannot say. */
export function assignedText(row: AppAssignment, auditVisible: boolean): string {
  if (row.assignedBy && row.assignedAt) {
    return `${row.assignedBy.name || 'Bilinmeyen kişi'} · ${formatInstant(row.assignedAt)}`;
  }
  return auditVisible ? 'Kayıt yok (panel öncesi ya da konsoldan)' : '';
}

/** A row's second line: kind, role, what it reaches, who made it. */
export function assignmentSubtitle(row: AppAssignment, auditVisible: boolean): string {
  return [
    row.type === 'group' ? 'Grup' : 'Kişi',
    row.role,
    row.type === 'group' ? row.path : row.email,
    inheritText(row),
    reachText(row),
    assignedText(row, auditVisible),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The removal question's description. */
export function removalText(row: Pick<AppAssignment, 'members'>): string {
  return `Bu atama ${row.members} kişinin erişimini kaldırır. Başka bir atamadan alanlar etkilenmez.`;
}

/** What an audit row did, in a word or two. */
export function auditActionText(entry: Pick<AppAuditEntry, 'action' | 'outcome'>): string {
  const verb = entry.action === 'app.assign' ? 'Atama' : 'Kaldırma';
  switch (entry.outcome) {
    case 'ok':
      return verb;
    case 'denied':
      return `${verb} reddedildi`;
    case 'failed':
      return `${verb} başarısız`;
    default:
      return `${verb} (sonuç bilinmiyor)`;
  }
}

/** An audit row's second line: target, role, when, note. */
export function auditSubtitle(entry: AppAuditEntry): string {
  const target = entry.type === 'group' ? entry.path : entry.name || 'Kişi';
  return [target, entry.role, formatInstant(entry.occurredAt), entry.note]
    .filter(Boolean)
    .join(' · ');
}

/** The roles to select first for a target: the app's suggestion, without what it holds already. */
export function initialRoles(suggested: readonly string[], target: AppTarget | null): string[] {
  const held = new Set(target?.assignedRoles ?? []);
  return suggested.filter((role) => !held.has(role));
}

/** A search result's second line in the add drawer. */
export function targetSubtitle(target: AppTarget): string {
  return [
    target.type === 'group' ? target.path : target.email,
    inheritText(target),
    target.type === 'group' ? reachText(target) : '',
    target.assignedRoles.length ? `Atanmış: ${target.assignedRoles.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
