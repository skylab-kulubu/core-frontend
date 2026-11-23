'use client';

import {
  BulkBar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
  MenuItem,
  MenuLinkItem,
  cn,
} from '@skylab-kulubu/skylcn-ui';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { ActionButton } from '@/components/chrome/ActionButton';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/** One command of a page's command bar, a bulk bar or a row's "⋯" menu. */
export type Command = {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** A link inside the panel, or a whole address for another site. */
  href?: string;
  onSelect?: () => void;
  /** Coloured as a removal in the "⋯" menu. */
  destructive?: boolean;
  disabled?: boolean;
};

/** Written commands shown beside the main one; the rest wait in "⋯" (Carbon: five at most). */
const MAX_VISIBLE = 4;

function CommandMenuItems({ commands }: { commands: readonly Command[] }) {
  return commands.map((command) =>
    command.href && !command.disabled ? (
      <MenuLinkItem
        key={command.key}
        icon={command.icon}
        destructive={command.destructive}
        render={/^https?:\/\//.test(command.href) ? undefined : <Link href={command.href} />}
        href={command.href}
      >
        {command.label}
      </MenuLinkItem>
    ) : (
      <MenuItem
        key={command.key}
        icon={command.icon}
        destructive={command.destructive}
        disabled={command.disabled}
        onClick={command.onSelect}
      >
        {command.label}
      </MenuItem>
    ),
  );
}

/** A "⋯" button that opens the commands as a menu, for a command bar's overflow or a row. */
export function CommandMenu({
  commands,
  label = 'Diğer komutlar',
  className,
}: {
  commands: readonly Command[];
  /** Names the button: "Diğer komutlar", or "<row name>: eylemler" on a row. */
  label?: string;
  className?: string;
}) {
  if (!commands.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            icon={MoreHorizontal}
            size="icon-sm"
            variant="ghost"
            label={label}
            className={className}
          />
        }
      />
      <DropdownMenuContent align="end">
        <CommandMenuItems commands={commands} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type CommandBarProps = {
  /** The page's one main command, written in full: "Duyuru ekle". */
  primary?: Command;
  /** The others, in order of use; written with their icon, past four in "⋯". */
  commands?: readonly Command[];
  /**
   * Rows chosen in the list: while any is, the bar turns into the bulk bar,
   * "3 seçili" and these commands.
   */
  selection?: { count: number; onClear: () => void; commands: readonly Command[] };
  'aria-label'?: string;
  className?: string;
};

/**
 * The command bar under a page's title (Azure portal, Entra): one main written
 * command first, the others beside it, the rest in "⋯". On phones the main
 * command stays and every other one goes into "⋯". With rows chosen it is the
 * bulk bar instead.
 */
export function CommandBar({
  primary,
  commands = [],
  selection,
  'aria-label': ariaLabel = 'Komutlar',
  className,
}: CommandBarProps) {
  if (selection && selection.count > 0) {
    return (
      <BulkBar count={selection.count} onClear={selection.onClear} className={className}>
        {selection.commands.map((command) => (
          <Button
            key={command.key}
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            disabled={command.disabled}
            onClick={command.onSelect}
            render={command.href ? <Link href={command.href} /> : undefined}
          >
            {command.icon ? <command.icon className="size-4" aria-hidden /> : null}
            {command.label}
          </Button>
        ))}
      </BulkBar>
    );
  }
  if (!primary && !commands.length) return null;
  const visible = commands.slice(0, MAX_VISIBLE);
  const overflow = commands.slice(MAX_VISIBLE);
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn('flex min-h-8 flex-wrap items-center gap-2', className)}
    >
      {primary ? (
        <ActionButton
          variant="primary"
          icon={primary.icon}
          label={primary.label}
          href={primary.href}
          onClick={primary.onSelect}
          disabled={primary.disabled}
        />
      ) : null}
      {visible.map((command) => (
        <ActionButton
          key={command.key}
          className="hidden sm:inline-flex"
          icon={command.icon}
          label={command.label}
          showLabel
          href={command.href}
          onClick={command.onSelect}
          disabled={command.disabled}
        />
      ))}
      {overflow.length ? (
        <CommandMenu commands={overflow} className="hidden sm:inline-flex" />
      ) : null}
      {commands.length ? <CommandMenu commands={commands} className="sm:hidden" /> : null}
    </div>
  );
}
