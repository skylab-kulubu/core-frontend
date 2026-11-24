'use client';

import { SkylcnProvider, ToastProvider, TooltipProvider } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { config as zodConfig } from 'zod';
import { NonceProvider } from '@/lib/security/nonce';

// zod tries `Function('')` to see whether it may compile its parsers; the panel's CSP allows no
// eval, so it would only fall back after a CSP report. Its interpreted parsers from the start.
zodConfig({ jitless: true });

export function Providers({ nonce, children }: { nonce?: string; children: ReactNode }) {
  return (
    <NonceProvider nonce={nonce}>
      <SkylcnProvider locale="tr" linkComponent={Link}>
        <ToastProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ToastProvider>
      </SkylcnProvider>
    </NonceProvider>
  );
}
