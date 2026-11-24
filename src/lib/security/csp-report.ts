// The panel's CSP reports (report-uri in content-security-policy.ts, route app/api/csp-report),
// so the report-only round can be read from the container's log instead of someone's console.
// One short line per report, without query strings (a presigned address carries a signature).

const MAX_BODY = 16 * 1024;
/** Reports one request may log; a browser batches a few at most. */
const MAX_REPORTS = 10;
/** Lines this process logs per minute; the rest are only counted (`csp-violation dropped=k`). */
export const MAX_LINES_PER_MINUTE = 60;
const MINUTE = 60_000;

type Report = Record<string, unknown>;

/** The address without its query and fragment; keywords ('inline', 'eval', 'data') as they are. */
function withoutQuery(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? `${url.origin}${url.pathname}`
      : url.protocol.replace(/:$/, '');
  } catch {
    return value.slice(0, 64);
  }
}

/** The legacy `{"csp-report": {...}}` body and the Reporting API's `[{type, body}]` alike. */
function reportsOf(payload: unknown): Report[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((item): item is { body: Report } => typeof item?.body === 'object' && item.body)
      .map((item) => item.body);
  }
  const legacy = (payload as { 'csp-report'?: Report } | null)?.['csp-report'];
  return legacy && typeof legacy === 'object' ? [legacy] : [];
}

/** A keyword such as a directive name, never longer than 64 characters. */
function word(value: unknown): string | undefined {
  return value == null ? undefined : String(value).slice(0, 64);
}

function summary(report: Report) {
  const pick = (...names: string[]) => names.map((name) => report[name]).find((v) => v != null);
  const line = pick('lineNumber', 'line-number');
  return {
    directive: word(pick('effectiveDirective', 'effective-directive', 'violated-directive')),
    blocked: withoutQuery(pick('blockedURL', 'blocked-uri')),
    page: withoutQuery(pick('documentURL', 'document-uri')),
    source: withoutQuery(pick('sourceFile', 'source-file')),
    line: typeof line === 'number' && Number.isFinite(line) ? line : undefined,
    disposition: word(pick('disposition')),
  };
}

// The route takes reports without a session, so the log may not grow faster than this process
// lets it: at most MAX_LINES_PER_MINUTE lines a minute; when the minute is over, one line says
// how many were dropped.
const minute = {
  start: 0,
  lines: 0,
  dropped: 0,
  timer: null as ReturnType<typeof setTimeout> | null,
};

function flushDropped() {
  if (minute.timer) clearTimeout(minute.timer);
  minute.timer = null;
  if (minute.dropped > 0) console.warn(`csp-violation dropped=${minute.dropped}`);
  minute.dropped = 0;
}

function log(line: string, now = Date.now()) {
  if (now - minute.start >= MINUTE) {
    flushDropped();
    Object.assign(minute, { start: now, lines: 0 });
  }
  if (minute.lines < MAX_LINES_PER_MINUTE) {
    minute.lines += 1;
    console.warn(line);
    return;
  }
  minute.dropped += 1;
  if (!minute.timer) {
    minute.timer = setTimeout(flushDropped, Math.max(0, minute.start + MINUTE - now));
    // Never keeps the process up on its own
    (minute.timer as { unref?: () => void }).unref?.();
  }
}

/** Test hook: a fresh minute, nothing pending. */
export function resetCspReportLimit() {
  if (minute.timer) clearTimeout(minute.timer);
  Object.assign(minute, { start: 0, lines: 0, dropped: 0, timer: null });
}

/** The body as text, or null when it is longer than MAX_BODY (read no further than that). */
async function boundedText(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

const noContent = () =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function handleCspReport(request: Request): Promise<Response> {
  const text = await boundedText(request).catch(() => null);
  if (!text) return noContent();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return noContent(); // Not JSON: nothing to log
  }
  for (const report of reportsOf(payload).slice(0, MAX_REPORTS)) {
    log(`csp-violation ${JSON.stringify(summary(report))}`);
  }
  return noContent();
}
