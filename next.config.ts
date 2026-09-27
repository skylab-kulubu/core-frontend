import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  // skylcn-ui ships ESM only; this also lets next/jest transform it for the tests
  transpilePackages: ['@skylab-kulubu/skylcn-ui'],
  // The skylcn-ui playground ships as static files in public/ (see the
  // Dockerfile's playground stage); its pages are the .html files there
  async rewrites() {
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
    return ['/playground', '/playground/:path*', '/playground-assets/:path*'].map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }));
  },
};

export default nextConfig;
