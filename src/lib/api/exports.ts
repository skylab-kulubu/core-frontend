import { coreFetchResponse } from './core';

/** The reports core's attendee export makes (core docs/attendee-export.md). */
export type ExportReport = 'attendees' | 'session' | 'matrix' | 'entries' | 'certificates';
export type ExportFormat = 'xlsx' | 'csv';

export type ExportRequest = {
  report: ExportReport;
  format: ExportFormat;
  /** The session of a `session` report. */
  sessionId?: string;
  /** The rows the list shows ("ekrandakini indir"): the file has those alone, in this order. */
  ticketIds?: string[];
};

const FILE_SLUGS: Record<ExportReport, string> = {
  attendees: 'katilimcilar',
  session: 'oturum-katilimi',
  matrix: 'katilim-matrisi',
  entries: 'alana-giris',
  certificates: 'sertifikalar',
};

const FOLD: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  i̇: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** The event's name as core writes it in a file name: lower-case ASCII joined by dashes. */
export function exportSlug(name: string): string {
  const folded = name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]|i̇/g, (letter) => FOLD[letter] ?? letter);
  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'etkinlik';
}

const istanbulStamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `<event>-<report>-<YYYYMMDD-HHMM>.<format>`, Istanbul's clock: core's name, for when its header is not readable. */
export function exportFileName(
  eventName: string,
  report: ExportReport,
  format: ExportFormat,
  now = new Date(),
): string {
  const part = Object.fromEntries(
    istanbulStamp.formatToParts(now).map((piece) => [piece.type, piece.value]),
  );
  const stamp = `${part.year}${part.month}${part.day}-${part.hour}${part.minute}`;
  return `${exportSlug(eventName)}-${FILE_SLUGS[report]}-${stamp}.${format}`;
}

/** The file name a `Content-Disposition` header gives, if any. */
export function dispositionName(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

/** Saves a blob as a file in the browser. */
export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // The download has its own copy; a later revoke keeps a slow browser from losing it
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const exportsApi = {
  /** Makes the report in core and saves it; core records each download (Team audit). */
  async download(eventId: string, eventName: string, request: ExportRequest): Promise<string> {
    const res = await coreFetchResponse(`/v1/events/${encodeURIComponent(eventId)}/exports`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    const name =
      dispositionName(res.headers.get('Content-Disposition')) ??
      exportFileName(eventName, request.report, request.format);
    saveBlob(await res.blob(), name);
    return name;
  },
};
