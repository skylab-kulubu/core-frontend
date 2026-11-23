'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  cn,
} from '@skylab-kulubu/skylcn-ui';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/**
 * The row of written commands under an object page's top band (the admin centre's command bar):
 * the object's actions by name, scrolling sideways on a phone instead of hiding behind a menu.
 * A named group, not a toolbar: each command is its own Tab stop (no arrow-key roving).
 */
export function CommandBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="border-border-subtle scrollbar-hidden -mx-1 flex items-center gap-1 overflow-x-auto border-b px-1 pb-2"
    >
      {children}
    </div>
  );
}

/** One command: an icon and its name, as a link or a button; `primary` for the one to do now. */
export function Command({
  icon: Icon,
  label,
  href,
  onClick,
  disabled,
  primary,
  title,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <Button
      variant={primary ? 'primary' : 'ghost'}
      size="sm"
      className={cn(BUTTON_TEXT, 'shrink-0')}
      disabled={disabled}
      title={title}
      onClick={onClick}
      render={href ? <Link href={href} /> : undefined}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

/** The commands used less often, as menu items behind "Diğer". */
export function CommandMenu({
  items,
  label = 'Diğer',
  name = 'Diğer eylemler',
}: {
  items: ReactNode[];
  label?: string;
  /** The button's name for screen readers; it starts with the written label. */
  name?: string;
}) {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={name}
            className={cn(BUTTON_TEXT, 'shrink-0')}
          >
            <MoreHorizontal aria-hidden />
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align="end">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}
