import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import { ThemeScript } from '@skylab-kulubu/skylcn-ui';
import './globals.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Providers } from './providers';

const sans = Space_Grotesk({
  variable: '--skylcn-font-sans',
  subsets: ['latin', 'latin-ext'],
});

const mono = Space_Mono({
  variable: '--skylcn-font-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'SKY LAB Yönetim',
  description: 'SKY LAB identity and club administration.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The request's CSP nonce (proxy.ts). Reading the headers renders every page per request,
  // which a nonce needs: a page built ahead of time would carry no nonce, or a stale one.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="antialiased">
        <Providers nonce={nonce}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
