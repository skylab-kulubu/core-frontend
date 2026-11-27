import { Space_Grotesk, Space_Mono } from 'next/font/google';

/** The panel's faces; skylcn-ui's tokens read them from these two variables. */
export const sans = Space_Grotesk({
  variable: '--skylcn-font-sans',
  subsets: ['latin', 'latin-ext'],
});

export const mono = Space_Mono({
  variable: '--skylcn-font-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
});
