import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
