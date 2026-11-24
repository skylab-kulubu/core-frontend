/** @jest-environment node */

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { headers } from 'next/headers';
import RootLayout from '@/app/layout';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

// The providers' own markup is not this test's business; only the nonce they are handed
jest.mock('@/app/providers', () => ({
  Providers: ({ nonce, children }: { nonce?: string; children: ReactNode }) => (
    <div data-providers-nonce={nonce ?? ''}>{children}</div>
  ),
}));

async function render(requestHeaders: Record<string, string>) {
  (headers as jest.Mock).mockResolvedValue(new Headers(requestHeaders));
  return renderToStaticMarkup(await RootLayout({ children: <main>sayfa</main> }));
}

describe('RootLayout', () => {
  it("puts the request's nonce on the theme script and hands it to the providers", async () => {
    const html = await render({ 'x-nonce': 'bm9uY2UtMQ==' });
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(script).toContain('nonce="bm9uY2UtMQ=="');
    expect(html).toContain('data-providers-nonce="bm9uY2UtMQ=="');
  });

  it('renders without a nonce outside a request the proxy saw', async () => {
    const html = await render({});
    expect(html).not.toMatch(/<script\b[^>]*\bnonce=/);
    expect(html).toContain('<main>sayfa</main>');
  });
});
