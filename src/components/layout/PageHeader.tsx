import { PageHeader as Header } from '@skylab-kulubu/skylcn-ui';
import type { ComponentProps } from 'react';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** skylcn-ui's PageHeader, its line under the title at 13px (skylcn-ui writes 11px). */
export function PageHeader({ description, ...props }: ComponentProps<typeof Header>) {
  return (
    <Header
      {...props}
      description={
        description ? <span className={`block ${TEXT_SECONDARY}`}>{description}</span> : undefined
      }
    />
  );
}
