import type { CertificateRule, CertificateRuleSession } from '@/lib/api/certificates';

/**
 * The certificate rule's arithmetic as core computes it (core
 * docs/certificate-rule.md): "at least M of the N counted Sessions".
 */

/** The rule kinds a write may choose; `ratio` is read only, an older Event's. */
export type WritableRule = 'none' | 'once' | 'count';

/** The default threshold, ⌈3N/4⌉ in integers as core does: 8 → 6, 4 → 3, 3 → 3; 0 for none. */
export function defaultMin(counted: number): number {
  return counted > 0 ? Math.floor((3 * counted + 3) / 4) : 0;
}

/** The threshold that applies: the default when none is set, else min(M, N). */
export function effectiveMin(minCount: number | null | undefined, counted: number): number {
  if (counted <= 0) return 0;
  if (minCount == null || minCount < 1) return defaultMin(counted);
  return Math.min(minCount, counted);
}

/** M of N as a whole percentage: 6/8 → 75, 2/3 → 67. */
export function percentOf(min: number, counted: number): number {
  return counted > 0 ? Math.round((min / counted) * 100) : 0;
}

/**
 * The threshold an older `ratio` rule stands for over N counted Sessions,
 * offered when it is turned into `count`: ⌈ratio × N⌉ with float noise taken
 * off (0.66 × 3 → 2, 0.67 × 3 → 3, 0.75 × 8 → 6), at least 1 and at most N.
 */
export function minFromRatio(ratio: number, counted: number): number {
  if (counted <= 0) return 1;
  return Math.min(counted, Math.max(1, Math.ceil(ratio * counted - 1e-9)));
}

/** Not cancelled: a cancelled Session counts for nothing whatever its marks say. */
const live = (session: Pick<CertificateRuleSession, 'cancelled'>) => !session.cancelled;

/** N: the live Sessions that count. */
export function countedTotal(
  sessions: readonly Pick<CertificateRuleSession, 'cancelled' | 'counted'>[],
): number {
  return sessions.filter((session) => live(session) && session.counted).length;
}

export type SessionMarks = { counted: boolean; required: boolean };

/**
 * A Session's marks after one box is changed: a required Session is always
 * counted, so ticking "Zorunlu" ticks "Sayılır" too and "Sayılır" cannot be
 * cleared while "Zorunlu" is on.
 */
export function withMark(
  marks: SessionMarks,
  box: 'counted' | 'required',
  value: boolean,
): SessionMarks {
  if (box === 'required') return { counted: value ? true : marks.counted, required: value };
  if (marks.required) return marks;
  return { ...marks, counted: value };
}

/**
 * The rule as the Sertifikalar tab's card says it, in parts:
 * "8 oturumdan en az 6 (%75)", "Zorunlu: Açılış, Final", "2 oturum sayılmıyor".
 */
export function ruleSummaryParts(rule: CertificateRule): string[] {
  if (rule.rule === 'none') return ['Sertifika yok'];
  // No session: whoever entered the event (core #422)
  if (rule.sessionless) return ['Oturumsuz etkinlik: etkinliğe giren alır'];
  const n = countedTotal(rule.sessions);
  const parts: string[] = [];
  if (rule.rule === 'once') {
    parts.push('En az bir oturum');
  } else if (n === 0) {
    parts.push('Sayılan oturum yok');
  } else {
    const min = rule.rule === 'count' ? effectiveMin(rule.minCount, n) : rule.effectiveMin;
    parts.push(`${n} oturumdan en az ${min} (%${percentOf(min, n)})`);
    if (rule.rule === 'ratio') parts.push(`eski oran %${Math.round((rule.ratio ?? 0) * 100)}`);
  }
  const required = rule.sessions.filter((session) => live(session) && session.required);
  if (required.length) parts.push(`Zorunlu: ${required.map((s) => s.title).join(', ')}`);
  const uncounted = rule.sessions.filter((session) => live(session) && !session.counted).length;
  if (uncounted) parts.push(`${uncounted} oturum sayılmıyor`);
  return parts;
}

/**
 * What stops a rule from being saved, by field: the threshold outside 1–N, a
 * rule that would count no Session while the program has some, or a required
 * Session that is not counted.
 */
export type RuleIssues = { minCount?: string; sessions?: string };

export function ruleIssues(draft: {
  rule: WritableRule;
  minCount: number | null;
  sessions: readonly Pick<CertificateRuleSession, 'id' | 'cancelled' | 'counted' | 'required'>[];
}): RuleIssues {
  const issues: RuleIssues = {};
  if (draft.rule === 'none') return issues;
  const n = countedTotal(draft.sessions);
  const liveCount = draft.sessions.filter(live).length;
  if (liveCount > 0 && n === 0) issues.sessions = 'En az bir oturum sayılmalı';
  if (draft.sessions.some((session) => session.required && !session.counted)) {
    issues.sessions = 'Zorunlu oturum sayılmalı';
  }
  if (draft.rule === 'count' && draft.minCount !== null && n > 0) {
    if (!Number.isInteger(draft.minCount) || draft.minCount < 1 || draft.minCount > n) {
      issues.minCount = `1 ile ${n} arasında olmalı`;
    }
  }
  return issues;
}

/**
 * Whether a new Session of the type counts by default: a networking Session
 * does not (Yusuf, 2026-11-23, S1). core decides the same when the body says
 * nothing; an older core reads no marks and ignores the field.
 */
export function countedByDefault(sessionType: string): boolean {
  return sessionType.trim().toUpperCase() !== 'NETWORKING';
}
