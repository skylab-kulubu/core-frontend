import type { BadgeTone } from '@skylab-kulubu/skylcn-ui';
import type { ImportOutcome, ImportReport, ImportRow } from '@/lib/api/tickets';

/** The list's limits core keeps (core docs/attendee-import.md). */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;

/** What a row does, as the preview says it (`done` false) and as the result (`done` true). */
export function importOutcomeLabel(row: ImportRow, done: boolean): string {
  switch (row.outcome) {
    case 'active':
      return done ? 'Bilet yazıldı' : 'Bilet yazılacak';
    case 'waitlisted':
      return done ? 'Bekleme listesinde' : 'Bekleme listesine';
    case 'full':
      return 'Kontenjan dolu';
    case 'existing':
      return row.ticketStatus === 'cancelled' ? 'İptal edilmiş bileti var' : 'Zaten kayıtlı';
    case 'duplicate':
      return 'Yinelenen';
    case 'invalid':
      return 'Hatalı';
  }
}

export const IMPORT_OUTCOME_TONE: Record<ImportOutcome, BadgeTone> = {
  active: 'success',
  waitlisted: 'warning',
  full: 'danger',
  existing: 'neutral',
  duplicate: 'neutral',
  invalid: 'danger',
};

const PROBLEMS: Record<string, string> = {
  missing_first_name: 'Ad yok',
  missing_last_name: 'Soyad yok',
  invalid_email: 'E-posta geçersiz',
  name_too_long: 'Ad ya da soyad 100 karakterden uzun',
  account_unavailable: 'Hesap artık yok',
};

/** The line under a row: why it is invalid, the Session it chose, the capacity. */
export function importRowNote(row: ImportRow): string {
  const parts: string[] = [];
  if (row.problem) parts.push(PROBLEMS[row.problem] ?? row.problem);
  if (row.outcome === 'existing' && row.ticketStatus === 'waitlisted')
    parts.push('bekleme listesinde');
  if (row.outcome === 'duplicate') parts.push('aynı e-posta üstte var');
  if (row.overCapacity) parts.push('kontenjanı aşar');
  if (row.sessions?.length) parts.push(`Oturum: ${row.sessions.map((s) => s.title).join(', ')}`);
  if (row.unknownSessions?.length)
    parts.push(`Bilinmeyen oturum: ${row.unknownSessions.join(', ')}`);
  return parts.join(' · ');
}

/** The figures above the rows, in the order the reader acts on them. */
export function importSummaryItems(
  report: ImportReport,
): { key: string; label: string; count: number; tone: BadgeTone }[] {
  const s = report.summary;
  const done = report.imported;
  return [
    {
      key: 'active',
      label: done ? 'Bilet yazıldı' : 'Bilet yazılacak',
      count: s.active,
      tone: 'success' as const,
    },
    {
      key: 'waitlisted',
      label: done ? 'Bekleme listesinde' : 'Bekleme listesine',
      count: s.waitlisted,
      tone: 'warning' as const,
    },
    { key: 'full', label: 'Kontenjan dolu', count: s.full, tone: 'danger' as const },
    { key: 'existing', label: 'Zaten kayıtlı', count: s.existing, tone: 'neutral' as const },
    { key: 'duplicates', label: 'Yinelenen', count: s.duplicates, tone: 'neutral' as const },
    { key: 'invalid', label: 'Hatalı', count: s.invalid, tone: 'danger' as const },
  ].filter((item) => item.count > 0);
}

/** Who gets a Ticket: members (an account holds the e-mail) and guests. */
export function importPeopleLine(report: ImportReport): string | null {
  const { members, guests } = report.summary;
  if (members + guests === 0) return null;
  return `${members} üye hesabına, ${guests} misafir olarak`;
}

/** The capacity before the import, in a line. */
export function importCapacityLine(report: ImportReport): string | null {
  const c = report.capacity;
  // The result's figures are from before the import: only the preview says them
  if (report.imported || c.capacity <= 0) return null;
  const list = c.waitlistEnabled ? 'bekleme listesi açık' : 'bekleme listesi kapalı';
  return `Kontenjan ${c.active}/${c.capacity}, ${c.free} yer boş, ${list}.`;
}

/** What happens to the new Tickets' mail. */
export function importMailLine(report: ImportReport): string {
  switch (report.mail) {
    case 'queued':
      return report.imported
        ? 'Yeni biletlerin postası gönderiliyor.'
        : 'Yeni biletlere bilet postası gider.';
    case 'off':
      return 'Posta gönderilmez; biletler sonra tek tek yeniden gönderilebilir.';
    case 'notifications_off':
      return 'Bilet postası şu an kapalı; posta gitmez.';
    case 'on_publish':
      return 'Etkinlik taslak: biletlere yayınlarken posta sorulur.';
  }
}

/** Rows to write: what the import button counts. */
export function importWrites(report: ImportReport): number {
  return report.summary.active + report.summary.waitlisted;
}

/** Why a picked file is refused before it is read, or null. */
export function importFileIssue(file: File): string | null {
  if (file.size > IMPORT_MAX_BYTES) return "Dosya 2 MB'tan büyük.";
  if (!/\.(csv|txt|tsv)$/i.test(file.name) && !/^text\//.test(file.type)) {
    return 'CSV dosyası seç (Excel: Farklı kaydet → CSV UTF-8).';
  }
  return null;
}
