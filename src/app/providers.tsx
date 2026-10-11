'use client';

import { SkylcnProvider, ToastProvider, TooltipProvider } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SkylcnProvider locale="tr" linkComponent={Link}>
      <ToastProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ToastProvider>
    </SkylcnProvider>
  );
}
