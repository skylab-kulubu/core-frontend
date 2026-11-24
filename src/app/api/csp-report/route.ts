// Where the browser sends the panel's CSP violations (report-uri in content-security-policy.ts),
// so the report-only round can be read from the container's log instead of someone's console.
// One short line per report, without query strings (a presigned address carries a signature).
export const dynamic = 'force-dynamic';

const MAX_BODY = 16 * 1024;

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

function summary(report: Report) {
  const pick = (...names: string[]) => names.map((name) => report[name]).find((v) => v != null);
  return {
    directive: pick('effectiveDirective', 'effective-directive', 'violated-directive'),
    blocked: withoutQuery(pick('blockedURL', 'blocked-uri')),
    page: withoutQuery(pick('documentURL', 'document-uri')),
    source: withoutQuery(pick('sourceFile', 'source-file')),
    line: pick('lineNumber', 'line-number'),
    disposition: pick('disposition'),
  };
}

export async function POST(request: Request) {
  const text = await request.text().catch(() => '');
  if (text && text.length <= MAX_BODY) {
    try {
      for (const report of reportsOf(JSON.parse(text)).slice(0, 10)) {
        console.warn(`csp-violation ${JSON.stringify(summary(report))}`);
      }
    } catch {
      // Not JSON: nothing to log
    }
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
