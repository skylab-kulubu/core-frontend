import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  // skylcn-ui ships ESM only; this also lets next/jest transform it for the tests
  transpilePackages: ['@skylab-kulubu/skylcn-ui'],
};

export default nextConfig;
