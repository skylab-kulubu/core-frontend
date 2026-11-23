import { ListItem as Item } from '@skylab-kulubu/skylcn-ui';
import type { ComponentProps } from 'react';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** skylcn-ui's ListItem, its line under the title at 13px (skylcn-ui writes 10px). */
export function ListItem({ subtitle, ...props }: ComponentProps<typeof Item>) {
  return (
    <Item
      {...props}
      subtitle={
        subtitle ? (
          <span className={`block truncate ${TEXT_SECONDARY}`}>{subtitle}</span>
        ) : undefined
      }
    />
  );
}
