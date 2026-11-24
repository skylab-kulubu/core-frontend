/** @jest-environment node */

import { POST } from '@/app/api/csp-report/route';

function report(body: string, type = 'application/csp-report') {
  return POST(
    new Request('https://admin.yildizskylab.com/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': type },
      body,
    }),
  );
}

describe('CSP report route', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('logs one line per report, without query strings', async () => {
    const response = await report(
      JSON.stringify({
        'csp-report': {
          'document-uri': 'https://admin.yildizskylab.com/events/1?tab=x',
          'violated-directive': 'connect-src',
          'effective-directive': 'connect-src',
          'blocked-uri': 'https://acc.r2.cloudflarestorage.com/b/k?X-Amz-Signature=secret',
          'source-file': 'https://admin.yildizskylab.com/_next/static/chunks/a.js',
          'line-number': 3,
          disposition: 'report',
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0]![0] as string;
    expect(line).toMatch(/^csp-violation /);
    expect(JSON.parse(line.slice('csp-violation '.length))).toEqual({
      directive: 'connect-src',
      blocked: 'https://acc.r2.cloudflarestorage.com/b/k',
      page: 'https://admin.yildizskylab.com/events/1',
      source: 'https://admin.yildizskylab.com/_next/static/chunks/a.js',
      line: 3,
      disposition: 'report',
    });
    expect(line).not.toContain('secret');
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
      'application/reports+json',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"blocked":"inline"'));
  });

  it.each([
    ['not JSON', 'nope'],
    ['an unknown shape', '{"x":1}'],
    ['too long a body', JSON.stringify({ 'csp-report': { pad: 'x'.repeat(20_000) } })],
  ])('answers 204 and logs nothing for %s', async (_, body) => {
    expect((await report(body)).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });
});
