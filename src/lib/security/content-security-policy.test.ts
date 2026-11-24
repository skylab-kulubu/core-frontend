/** @jest-environment node */

import {
  contentSecurityPolicy,
  cspHeaderName,
  GITHUB_AVATAR_ORIGIN,
  MEDIA_STORAGE_ORIGIN,
  policyOrigins,
  SANDBOX_CDN_ORIGIN,
} from '@/lib/security/content-security-policy';

const PRODUCTION = {
  NEXT_PUBLIC_API_URL: 'https://api.yildizskylab.com',
  NEXT_PUBLIC_CMS_URL: 'https://api.yildizskylab.com/api',
  NEXT_PUBLIC_GITHUB_ACTIVITY_URL: 'https://api.yildizskylab.com/v1/dashboard/github-activity',
};
const SANDBOX = {
  NEXT_PUBLIC_API_URL: 'https://sandbox-api.yildizskylab.com',
  NEXT_PUBLIC_CMS_URL: 'https://sandbox-api.yildizskylab.com/api',
  NEXT_PUBLIC_GITHUB_ACTIVITY_URL:
    'https://sandbox-api.yildizskylab.com/v1/dashboard/github-activity',
};

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name!, sources] as const;
    }),
  );
}

function image(env: Record<string, string>, enforce = true) {
  return directives(
    contentSecurityPolicy('bm9uY2U=', {
      development: false,
      enforce,
      origins: policyOrigins(env),
    }),
  );
}

describe('cspHeaderName', () => {
  it('reports only unless CSP_ENFORCE is exactly true', () => {
    expect(cspHeaderName(undefined)).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('')).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('1')).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('TRUE')).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('true')).toBe('Content-Security-Policy');
  });
});

describe('contentSecurityPolicy in the image', () => {
  it('runs only scripts carrying the nonce, and what they load', () => {
    const policy = image(PRODUCTION);
    expect(policy.get('script-src')).toEqual(["'self'", "'nonce-bm9uY2U='", "'strict-dynamic'"]);
    expect(policy.get('style-src')).toEqual(["'self'", "'nonce-bm9uY2U='"]);
    expect(policy.get('style-src-attr')).toEqual(["'unsafe-inline'"]);
    expect(policy.has('script-src-attr')).toBe(false);
    expect(policy.has('style-src-elem')).toBe(false);
    expect([...policy.values()].flat()).not.toContain("'unsafe-eval'");
    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
  });

  it('allows no plugins, no <base>, no framing by others, and forms only to the panel', () => {
    const policy = image(PRODUCTION);
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.get('report-uri')).toEqual(['/api/csp-report']);
  });

  it('lets the browser call production core, the CDN and the media storage, nothing else', () => {
    const policy = image(PRODUCTION);
    expect(policy.get('connect-src')).toEqual([
      "'self'",
      'https://api.yildizskylab.com',
      'https://cdn.yildizskylab.com',
      MEDIA_STORAGE_ORIGIN,
    ]);
    expect(policy.get('img-src')).toEqual([
      "'self'",
      'data:',
      'blob:',
      'https://api.yildizskylab.com',
      'https://cdn.yildizskylab.com',
      MEDIA_STORAGE_ORIGIN,
      GITHUB_AVATAR_ORIGIN,
    ]);
    expect(policy.get('media-src')).toEqual([
      "'self'",
      'blob:',
      'https://cdn.yildizskylab.com',
      MEDIA_STORAGE_ORIGIN,
    ]);
    expect(policy.get('frame-src')).toEqual([
      "'self'",
      'blob:',
      'https://cdn.yildizskylab.com',
      MEDIA_STORAGE_ORIGIN,
    ]);
    expect(policy.get('worker-src')).toEqual(["'self'", 'blob:']);
    expect(policy.get('font-src')).toEqual(["'self'"]);
    expect([...policy.values()].flat().join(' ')).not.toContain('sandbox');
  });

  it("calls the sandbox's core and CDN from the sandbox image", () => {
    const policy = image(SANDBOX);
    expect(policy.get('connect-src')).toEqual([
      "'self'",
      'https://sandbox-api.yildizskylab.com',
      'https://cdn.yildizskylab.com',
      SANDBOX_CDN_ORIGIN,
      MEDIA_STORAGE_ORIGIN,
    ]);
    expect(policy.get('img-src')).toContain(SANDBOX_CDN_ORIGIN);
    expect(policy.get('connect-src')).not.toContain('https://api.yildizskylab.com');
  });

  it('upgrades insecure requests only when the policy binds (report-only ignores it)', () => {
    expect(image(PRODUCTION, true).has('upgrade-insecure-requests')).toBe(true);
    expect(image(PRODUCTION, false).has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('contentSecurityPolicy under next dev', () => {
  it("allows eval, inline styles and the dev server's socket, which next dev needs", () => {
    const policy = directives(
      contentSecurityPolicy('bm9uY2U=', {
        development: true,
        enforce: true,
        origins: policyOrigins({ NEXT_PUBLIC_API_URL: 'http://localhost:3000/sandbox-api' }),
      }),
    );
    expect(policy.get('script-src')).toContain("'unsafe-eval'");
    expect(policy.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy.get('connect-src')).toContain('ws:');
    expect(policy.get('connect-src')).toContain('http://localhost:3000');
    expect(policy.get('img-src')).toContain(SANDBOX_CDN_ORIGIN);
    expect(policy.has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('policyOrigins', () => {
  it('skips an address that is missing or not a URL', () => {
    expect(policyOrigins({ NEXT_PUBLIC_API_URL: 'not a url' })).toEqual({
      api: null,
      otherApis: [],
      media: ['https://cdn.yildizskylab.com'],
    });
  });

  it('takes the CDN from NEXT_PUBLIC_CDN_URL when it is set', () => {
    expect(
      policyOrigins({ ...PRODUCTION, NEXT_PUBLIC_CDN_URL: 'https://media.example.test/base/' })
        .media,
    ).toEqual(['https://media.example.test']);
  });
});
