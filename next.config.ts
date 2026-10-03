import type { NextConfig } from 'next';

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

export default nextConfig;
