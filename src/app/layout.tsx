import type { Metadata } from 'next';
import { Space_Grotesk, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-sans-loaded',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
    <html lang="tr">
      <body className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
