/** @jest-environment node */

import { POST } from '@/app/api/csp-report/route';
import { MAX_LINES_PER_MINUTE, resetCspReportLimit } from '@/lib/security/csp-report';

const URL_ = 'https://admin.yildizskylab.com/api/csp-report';

function report(body: BodyInit, headers: Record<string, string> = {}) {
  return POST(
    new Request(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report', ...headers },
      body,
      // A stream body needs it in Node's fetch
      ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
    } as RequestInit),
  );
}

function legacy(fields: Record<string, unknown>) {
  return JSON.stringify({ 'csp-report': fields });
}

function logged(warn: jest.SpyInstance): Record<string, unknown>[] {
  return warn.mock.calls
    .map((call) => call[0] as string)
    .filter((line) => line.startsWith('csp-violation {'))
    .map((line) => JSON.parse(line.slice('csp-violation '.length)));
}

describe('CSP report route', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetCspReportLimit();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    resetCspReportLimit();
    jest.useRealTimers();
  });

  it('logs one line per report, without query strings', async () => {
    const response = await report(
      legacy({
        'document-uri': 'https://admin.yildizskylab.com/events/1?tab=x',
        'violated-directive': 'connect-src',
        'effective-directive': 'connect-src',
        'blocked-uri': 'https://acc.r2.cloudflarestorage.com/b/k?X-Amz-Signature=secret',
        'source-file': 'https://admin.yildizskylab.com/_next/static/chunks/a.js',
        'line-number': 3,
        disposition: 'report',
      }),
    );
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(logged(warn)).toEqual([
      {
        directive: 'connect-src',
        blocked: 'https://acc.r2.cloudflarestorage.com/b/k',
        page: 'https://admin.yildizskylab.com/events/1',
        source: 'https://admin.yildizskylab.com/_next/static/chunks/a.js',
        line: 3,
        disposition: 'report',
      },
    ]);
    expect(warn.mock.calls[0]![0]).not.toContain('secret');
  });

  it('reads the Reporting API body too', async () => {
    await report(
      JSON.stringify([
        {
          type: 'csp-violation',
          body: {
            documentURL: 'https://admin.yildizskylab.com/login',
            effectiveDirective: 'script-src-elem',
            blockedURL: 'inline',
            disposition: 'enforce',
          },
        },
      ]),
      { 'content-type': 'application/reports+json' },
    );
    expect(logged(warn)).toEqual([
      expect.objectContaining({ directive: 'script-src-elem', blocked: 'inline' }),
    ]);
  });

  it('cuts the directive and the disposition to 64 characters and drops a line that is no number', async () => {
    await report(
      legacy({
        'effective-directive': 'x'.repeat(200),
        disposition: 'y'.repeat(200),
        'line-number': '12; rm -rf /',
      }),
    );
    const [line] = logged(warn);
    expect(line!.directive).toBe('x'.repeat(64));
    expect(line!.disposition).toBe('y'.repeat(64));
    expect(line).not.toHaveProperty('line');
  });

  it('logs at most 10 reports of one request', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      type: 'csp-violation',
      body: { effectiveDirective: `img-src-${i}` },
    }));
    await report(JSON.stringify(many), { 'content-type': 'application/reports+json' });
    expect(logged(warn)).toHaveLength(10);
  });

  it('answers 204 without reading a body that says it is over 16 KB', async () => {
    const response = await report(legacy({ 'effective-directive': 'img-src' }), {
      'content-length': String(16 * 1024 + 1),
    });
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stops reading a body past 16 KB that did not say how long it is', async () => {
    const encoder = new TextEncoder();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        // A valid report's start, then padding without end
        controller.enqueue(
          encoder.encode(pulls === 1 ? '{"csp-report":{"pad":"' : 'x'.repeat(4096)),
        );
      },
    });
    const response = await report(stream);
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    expect(pulls).toBeLessThan(10);
  });

  it.each([
    ['not JSON', 'nope'],
    ['an unknown shape', '{"x":1}'],
    ['an empty body', ''],
  ])('answers 204 and logs nothing for %s', async (_, body) => {
    expect((await report(body)).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs at most 60 lines a minute, then one line with how many it dropped', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-24T12:00:00Z') });
    const one = legacy({ 'effective-directive': 'img-src' });
    for (let i = 0; i < MAX_LINES_PER_MINUTE + 5; i += 1) await report(one);
    expect(logged(warn)).toHaveLength(MAX_LINES_PER_MINUTE);
    expect(warn).not.toHaveBeenCalledWith('csp-violation dropped=5');

    jest.advanceTimersByTime(60_000);
    expect(warn).toHaveBeenLastCalledWith('csp-violation dropped=5');

    // A new minute logs again
    await report(one);
    expect(logged(warn)).toHaveLength(MAX_LINES_PER_MINUTE + 1);
  });
});
