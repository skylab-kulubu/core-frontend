import type {
  CertificateAttendance,
  CertificateAttendanceRow,
  CertificateAttendanceStatus,
  CertificateEventSummary,
  CertificateMailState,
} from '@/lib/api/certificates';
import type { EventDay } from '@/lib/api/eventDays';
import type { EventSession } from '@/lib/api/sessions';
import { eventEndsAt, type DatedEvent } from '@/lib/events-view';
import { matchesQuery } from '@/lib/list-query';
import type { StatusChipKind } from '@/lib/status-chip';

/**
 * The Sertifikalar tab's list of who attended how much (core
 * docs/certificate-rule.md, "Attendance list"): its views, the manual issue's
 * justification, the rescan's count and the line that says when attendance closes.
 */

export type AttendanceView = 'all' | 'eligible' | 'below' | 'issued';

export const ATTENDANCE_STATUS: Record<
  CertificateAttendanceStatus,
  { label: string; kind: StatusChipKind }
> = {
  eligible: { label: 'Uygun', kind: 'upcoming' },
  below: { label: 'Eşik altı', kind: 'pending' },
  issued: { label: 'Verildi', kind: 'active' },
  queued: { label: 'Sırada', kind: 'neutral' },
  failed: { label: 'Başarısız', kind: 'cancelled' },
  revoked: { label: 'İptal', kind: 'ended' },
};

type RuleOf = Pick<CertificateAttendance, 'rule' | 'countedTotal' | 'effectiveMin'>;

/** The rows the search keeps, by name. */
export function searchAttendance(
  rows: readonly CertificateAttendanceRow[],
  query: string,
): CertificateAttendanceRow[] {
  return rows.filter((row) => matchesQuery(query, row.name));
}

/**
 * Meets the rule and holds no certificate yet: who a finalization queues
 * (core's `finalizationTickets`: eligible, no active certificate), whatever
 * job or revoked certificate it has. The "Uygun" card, chip and confirmation.
 */
export function eligibleUnissued(rule: RuleOf, row: CertificateAttendanceRow): boolean {
  return row.status !== 'issued' && meetsRule(rule, row);
}

/** The rows a view shows, out of the searched ones. */
export function viewAttendance(
  rows: readonly CertificateAttendanceRow[],
  view: AttendanceView,
  rule: RuleOf,
): CertificateAttendanceRow[] {
  if (view === 'all') return [...rows];
  if (view === 'eligible') return rows.filter((row) => eligibleUnissued(rule, row));
  return rows.filter((row) => row.status === view);
}

/** How many certificates closing the attendance queues now. */
export function finalizeCount(list: CertificateAttendance): number {
  return list.rows.filter((row) => eligibleUnissued(list, row)).length;
}

/** "Hepsi 42 · Uygun 30 · Eşik altı 8 · Verildi 4" over the searched rows. */
export function attendanceViewCounts(
  rows: readonly CertificateAttendanceRow[],
  rule: RuleOf,
): Record<AttendanceView, number> {
  return {
    all: rows.length,
    eligible: viewAttendance(rows, 'eligible', rule).length,
    below: viewAttendance(rows, 'below', rule).length,
    issued: viewAttendance(rows, 'issued', rule).length,
  };
}

/**
 * Whether the rule makes the Ticket eligible now, whatever its certificate:
 * a counted Session at all, every required one, and at least the threshold
 * (`effectiveMin` is core's, the fewest check-ins the rule takes).
 */
export function meetsRule(
  list: RuleOf,
  row: Pick<CertificateAttendanceRow, 'attended' | 'missingRequired'>,
): boolean {
  if (list.rule === 'none' || list.countedTotal < 1) return false;
  if (row.missingRequired.length > 0) return false;
  return row.attended >= Math.max(1, list.effectiveMin);
}

/** "Elle ver" in the row menu: someone with no certificate and nothing queued or failed. */
export function issuableByHand(row: Pick<CertificateAttendanceRow, 'status'>): boolean {
  return row.status === 'eligible' || row.status === 'below';
}

/** A certificate mail's state as a chip (core docs/certificate-mail.md). */
export const MAIL_STATUS: Record<
  CertificateMailState['status'],
  { label: string; kind: StatusChipKind }
> = {
  sent: { label: 'Gönderildi', kind: 'active' },
  queued: { label: 'Sırada', kind: 'neutral' },
  failed: { label: 'Gönderilemedi', kind: 'cancelled' },
  cancelled: { label: 'Gönderilmedi', kind: 'ended' },
};

/** Why a mail waits or failed, in a few words; null when there is nothing to say. */
export function mailReason(
  mail: Pick<CertificateMailState, 'status' | 'errorCode'>,
): string | null {
  const code = mail.errorCode ?? '';
  if (!code || mail.status === 'sent') return null;
  if (code === 'skymail_unreachable') return "SkyMail'e ulaşılamadı";
  if (code === 'skymail_400' || code === 'skymail_422') return 'SkyMail reddetti';
  if (code.startsWith('skymail_')) return 'SkyMail hata verdi';
  if (code === 'mail_unconfigured') return 'Posta ayarı yok';
  if (code === 'no_recipient') return 'Adres yok';
  if (code === 'expired') return 'Süresi doldu';
  if (code === 'revoked') return 'Sertifika iptal';
  return 'Gönderilemedi';
}

/** Its mail may be sent again: an active certificate, when core keeps mails at all. */
export function mailResendable(
  certificate: { revokedAt?: string } | null | undefined,
  summary: Pick<CertificateEventSummary, 'mailFailedCount'> | undefined,
): boolean {
  return Boolean(certificate && !certificate.revokedAt && summary?.mailFailedCount !== undefined);
}

/** What a resend did, in one line. */
export function mailResendLine(result: { queued: number; alreadyQueued: number }): string {
  const parts = [`${result.queued} posta sıraya alındı.`];
  if (result.alreadyQueued) parts.push(`${result.alreadyQueued} kişinin postası zaten sırada.`);
  return parts.join(' ');
}

/** Core refuses a manual issue below the threshold without a justification. */
export function needsJustification(
  list: Pick<CertificateAttendance, 'rule' | 'countedTotal' | 'effectiveMin'>,
  row: Pick<CertificateAttendanceRow, 'attended' | 'missingRequired'>,
): boolean {
  return !meetsRule(list, row);
}

/** The justification's limit, as core's (`justification_too_long` past it). */
export const JUSTIFICATION_MAX = 500;

/**
 * How many "Uygunları yeniden tara" queues, as core picks them: eligible now
 * and never had a certificate (not issued, not revoked) and nothing queued or
 * running. A failed job is taken again.
 */
export function rescanCount(list: CertificateAttendance): number {
  return list.rows.filter(
    (row) =>
      (row.status === 'eligible' || row.status === 'failed') &&
      !row.certificate &&
      meetsRule(list, row),
  ).length;
}

const TIME_ZONE = 'Europe/Istanbul';

const DAY_MONTH_YEAR_TIME = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
});

// The last word of a number read aloud, 0–59: "on dokuz" ends in "dokuz", "kırk" in "kırk".
const UNITS = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli'];

function lastWord(n: number): string {
  if (n === 0) return UNITS[0];
  return n % 10 === 0 ? TENS[n / 10] : UNITS[n % 10];
}

/**
 * The locative suffix after a time read aloud: "19:00'da", "18:00'de", "14:15'te",
 * "11:40'ta". The minute is read when it is not zero, else the hour.
 */
export function locativeAfterTime(hour: number, minute: number): string {
  const word = lastWord(minute === 0 ? hour : minute);
  const back = /[aıou][^aeıioöuü]*$/.test(word);
  const hard = /[fstkçşhp]$/.test(word);
  return `'${hard ? 't' : 'd'}${back ? 'a' : 'e'}`;
}

function parts(format: Intl.DateTimeFormat, at: Date) {
  const get = (type: string) => format.formatToParts(at).find((p) => p.type === type)?.value ?? '';
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** "24 Kasım 19:00", or with the year when it is not this year's. */
export function closeTimeLabel(raw: string, now = new Date()): string {
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return '';
  const thisYear = parts(DAY_MONTH_YEAR_TIME, now).year;
  const p = parts(DAY_MONTH_YEAR_TIME, at);
  const date = p.year === thisYear ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`;
  return `${date} ${p.hour}:${p.minute}`;
}

/**
 * The line over the commands: when attendance closes by itself, or who closed
 * it and when. Null when core says neither (an older core, or no time: the
 * switch is off, no Session has an end).
 */
export function attendanceCloseLine(
  summary: Pick<
    CertificateEventSummary,
    'attendanceFinalizedAt' | 'autoFinalizeAt' | 'finalizedSource'
  >,
  now = new Date(),
): string | null {
  if (summary.attendanceFinalizedAt) {
    const by =
      summary.finalizedSource === 'auto'
        ? ' · kendiliğinden'
        : summary.finalizedSource === 'manual'
          ? ' · elle'
          : '';
    return `Katılım kapandı${by} · ${closeTimeLabel(summary.attendanceFinalizedAt, now)}`;
  }
  if (!summary.autoFinalizeAt) return null;
  const at = new Date(summary.autoFinalizeAt);
  if (Number.isNaN(at.getTime())) return null;
  const p = parts(DAY_MONTH_YEAR_TIME, at);
  const suffix = locativeAfterTime(Number(p.hour), Number(p.minute));
  return `Katılım ${closeTimeLabel(summary.autoFinalizeAt, now)}${suffix} kendiliğinden kapanacak`;
}

/**
 * When the Event's last live Session ends, as core reads it for early
 * finalization (K7): its end time, else its day's end, else the Event's.
 * Null without a live Session or an end.
 */
export function lastSessionEndsAt(
  event: Pick<DatedEvent, 'startDate' | 'endDate'>,
  days: readonly Pick<EventDay, 'id' | 'endDate'>[],
  sessions: readonly Pick<EventSession, 'eventDayId' | 'endTime' | 'cancelled'>[],
): number | null {
  const dayEnd = new Map(days.map((day) => [day.id, day.endDate]));
  let last: number | null = null;
  for (const session of sessions) {
    if (session.cancelled || !dayEnd.has(session.eventDayId)) continue;
    const raw = session.endTime || dayEnd.get(session.eventDayId);
    const end = raw ? Date.parse(raw) : eventEndsAt(event);
    if (end === null || Number.isNaN(end)) continue;
    if (last === null || end > last) last = end;
  }
  return last;
}

/**
 * Whether core opens finalization before the Event ends: published and its
 * last live Session over (core's `finalizeOpen`, K7 and S4).
 */
export function lastSessionEnded(
  event: Pick<DatedEvent, 'status' | 'startDate' | 'endDate'>,
  days: readonly Pick<EventDay, 'id' | 'endDate'>[],
  sessions: readonly Pick<EventSession, 'eventDayId' | 'endTime' | 'cancelled'>[],
  now = new Date(),
): boolean {
  if (event.status !== 'published') return false;
  const end = lastSessionEndsAt(event, days, sessions);
  return end !== null && end <= now.getTime();
}

/**
 * A person's attendance as the list says it: "6/8 oturum", or on an event without sessions
 * (core #422) whether they entered.
 */
export function attendedText(
  list: Pick<CertificateAttendance, 'countedTotal' | 'sessionless'>,
  row: Pick<CertificateAttendanceRow, 'attended'>,
  unit = ' oturum',
): string {
  if (list.sessionless) return row.attended > 0 ? 'Girdi' : 'Girmedi';
  return `${row.attended}/${list.countedTotal}${unit}`;
}
