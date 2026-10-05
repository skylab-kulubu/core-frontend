import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Off unless the image is built with the playground (see the Dockerfile)
const includePlayground = process.env.NEXT_PUBLIC_INCLUDE_PLAYGROUND === 'true';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  // skylcn-ui ships ESM only; this also lets next/jest transform it for the tests
  transpilePackages: ['@skylab-kulubu/skylcn-ui'],
  // The skylcn-ui playground ships as static files in public/ (see the
  // Dockerfile's playground stage); its pages are the .html files there.
  // Without NEXT_PUBLIC_INCLUDE_PLAYGROUND=true there are no such files, and
  // the app neither rewrites nor serves anything under /playground
  async rewrites() {
    if (!includePlayground) return [];
    return {
      beforeFiles: [],
      afterFiles: [
        { source: '/playground', destination: '/playground.html' },
        { source: '/playground/:path*', destination: '/playground/:path*.html' },
      ],
      fallback: [],
    };
  },
  async headers() {
    if (!includePlayground) return [];
    return ['/playground', '/playground/:path*', '/playground-assets/:path*'].map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }));
  },
};

// Local development only (`next dev`). The club's edge does not let a page on
// http://localhost:3000 call its hosts cross-origin, so the browser calls this
// dev server on its own origin and the server forwards /sandbox-api/* to the
// sandbox API, never to production. .env.local points the API addresses at
// http://localhost:3000/sandbox-api (README). `next build` never adds this
// rewrite, so the images forward nothing.
const sandboxApi = {
  source: '/sandbox-api/:path*',
  destination: 'https://sandbox-api.yildizskylab.com/:path*',
};

// Addresses the browser calls; one naming a club host sends it there directly
const BROWSER_URLS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_CMS_URL',
  'NEXT_PUBLIC_GITHUB_ACTIVITY_URL',
];

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;
  for (const name of BROWSER_URLS) {
    const value = process.env[name] ?? '';
    if (/^https:\/\/([\w-]+\.)*yildizskylab\.com(\/|$)/.test(value)) {
      console.warn(
        `⚠ ${name}=${value}: the browser would call that host from http://localhost:3000, which the edge does not allow. Use http://localhost:3000/sandbox-api (README).`,
      );
    }
  }
  return {
    ...nextConfig,
    async rewrites() {
      const own = await nextConfig.rewrites!();
      if (Array.isArray(own)) return [...own, sandboxApi];
      return { ...own, afterFiles: [...(own.afterFiles ?? []), sandboxApi] };
    },
  };
}
