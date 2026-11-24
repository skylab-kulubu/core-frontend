/** @jest-environment node */

import { PHASE_PRODUCTION_SERVER } from 'next/constants';
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server';
import config from '../next.config';

async function configuredHeaders(path: string) {
  const response = await unstable_getResponseFromNextConfig({
    url: `https://admin.yildizskylab.com${path}`,
    nextConfig: config(PHASE_PRODUCTION_SERVER),
  });
  return response.headers;
}

describe('configured response headers', () => {
  it.each([
    '/',
    '/login',
    '/dashboard',
    '/events/abc/program',
    '/api/health',
    '/_next/static/x.js',
  ])('send the security headers on %s', async (path) => {
    const headers = await configuredHeaders(path);
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });

  it('keeps the camera for the door scanner on the panel itself and turns the rest off', async () => {
    const policy = (await configuredHeaders('/events/abc/door')).get('permissions-policy') ?? '';
    const features = new Map(
      policy.split(', ').map((entry) => entry.split('=') as [string, string]),
    );
    expect(features.get('camera')).toBe('(self)');
    for (const feature of ['microphone', 'geolocation', 'payment', 'usb', 'display-capture']) {
      expect(features.get(feature)).toBe('()');
    }
  });

  it('does not name the framework', () => {
    expect(config(PHASE_PRODUCTION_SERVER).poweredByHeader).toBe(false);
  });
});
