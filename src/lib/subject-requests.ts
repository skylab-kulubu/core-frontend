import type {
  SubjectRequest,
  SubjectRequestChannel,
  SubjectRequestStatus,
  SubjectRequestType,
} from '@/lib/api/subject-requests';
import type { StatusChipKind } from '@/lib/status-chip';

export const CHANNEL_LABELS: Record<SubjectRequestChannel, string> = {
  email: 'E-posta (info@)',
  post: 'Posta',
  in_person: 'Elden',
};

/** md. 11/1's clauses in the law's order, with their letters. */
export const TYPE_LABELS: Record<SubjectRequestType, string> = {
  learn: '(a) İşlenip işlenmediğini öğrenme',
  info: '(b) İşlemeye ilişkin bilgi',
  purpose: '(c) Amaç ve amaca uygunluk',
  recipients: '(ç) Aktarılan üçüncü kişiler',
  rectify: '(d) Düzeltme',
  erase: '(e) Silme ya da yok etme',
  notify_recipients: '(f) Üçüncü kişilere bildirme',
  object_automated: '(g) Otomatik analiz sonucuna itiraz',
  compensation: '(ğ) Zararın giderilmesi',
  other: 'Diğer (rıza geri alma, fotoğraf itirazı)',
};

export const TYPE_ORDER = Object.keys(TYPE_LABELS) as SubjectRequestType[];

export const STATUS_LABELS: Record<SubjectRequestStatus, string> = {
  received: 'Alındı',
  awaiting_verification: 'Kimlik onayı bekleniyor',
  answered: 'Cevaplandı',
  rejected: 'Gerekçeli ret',
};

const STATUS_KINDS: Record<SubjectRequestStatus, StatusChipKind> = {
  received: 'pending',
  awaiting_verification: 'pending',
  answered: 'active',
  rejected: 'neutral',
};

export function statusKind(status: SubjectRequestStatus): StatusChipKind {
  return STATUS_KINDS[status];
}

export function isConcluded(status: SubjectRequestStatus): boolean {
  return status === 'answered' || status === 'rejected';
}

/** The default responder, by title: the club's representative answers (KVKK md. 13). */
export const DEFAULT_RESPONDER = 'YK Başkanı';

/** Today in Turkey as YYYY-MM-DD: the register's days are the club's. */
export function todayInTurkey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Days from today to the due date: 0 is the last day, below 0 is late. */
export function daysLeft(dueOn: string, today: string): number {
  return Math.round(dayNumber(dueOn) - dayNumber(today));
}

/** The panel's only reminder (no mail): an open request 7 days or less from its due date, or past it. */
export const DEADLINE_WARNING_DAYS = 7;

export type DeadlineBadge = { label: string; kind: StatusChipKind };

export function deadlineBadge(
  request: Pick<SubjectRequest, 'status' | 'dueOn'>,
  today: string,
): DeadlineBadge | null {
  if (isConcluded(request.status)) return null;
  const left = daysLeft(request.dueOn, today);
  if (left < 0) return { label: 'Süre geçti', kind: 'cancelled' };
  if (left === 0) return { label: 'Bugün son gün', kind: 'cancelled' };
  if (left <= DEADLINE_WARNING_DAYS) return { label: `${left} gün kaldı`, kind: 'pending' };
  return null;
}

/** YYYY-MM-DD as the panel shows it: 27.10.2026. */
export function formatDay(date: string | null | undefined): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

const FIELD_LABELS: Record<string, string> = {
  receivedOn: 'başvuru tarihi',
  channel: 'kanal',
  requesterName: 'ad',
  requesterContact: 'iletişim',
  userId: 'hesap',
  requestTypes: 'talep türü',
  status: 'durum',
  answeredOn: 'cevap tarihi',
  answerSummary: 'cevap özeti',
  responder: 'yanıtlayan',
};

/** A trail row's fields in Turkish; the trail holds names only, never values. */
export function describeFields(fields: readonly string[]): string {
  return fields.map((field) => FIELD_LABELS[field] ?? field).join(', ');
}
