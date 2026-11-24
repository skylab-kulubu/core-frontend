'use client';

import { SkylcnProvider, ToastProvider, TooltipProvider } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NonceProvider } from '@/lib/security/nonce';

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
