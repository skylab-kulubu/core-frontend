'use client';

import { ServerErrorScenePage, useTheme } from '@skylab-kulubu/skylcn-ui';
import { useEffect } from 'react';
import { mono, sans } from './fonts';
import './globals.css';

/**
 * The last error boundary: the root layout itself broke, so this page replaces it and brings
 * its own <html> and <body>. The 500 scene with a retry. Without the layout there is no theme
 * script (it needs the request's nonce), so the reader's theme is set once the page runs.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useTheme();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ServerErrorScenePage onAction={reset} />
      </body>
    </html>
  );
}
