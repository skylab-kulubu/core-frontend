'use client';

import { Button, IconButton, cn } from '@skylab-kulubu/skylcn-ui';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Ref } from 'react';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

type ActionButtonProps = {
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  label?: string;
  variant?: 'ghost' | 'primary';
  /** Writes the label beside the icon; a primary action always does. */
  showLabel?: boolean;
  /** Under 640px the written label hides and the icon stays, named for screen readers. */
  iconOnlyOnPhone?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  /** For a drawer's fallback focus, when the row that opened it is gone. */
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A toolbar or row action; a link when it has `href`. A page's main action (primary, or
 * `showLabel`) is an icon and its label; a row's small action is the icon alone, named by
 * `label` for screen readers and on hover.
 */
export function ActionButton({
  href,
  onClick,
  icon: Icon = ChevronRight,
  label,
  variant = 'ghost',
  showLabel = variant === 'primary',
  iconOnlyOnPhone = false,
  className,
  title,
  disabled,
  ref,
}: ActionButtonProps) {
  const name = label ?? title ?? '';
  const render = href ? (
    /^https?:\/\//.test(href) ? (
      <a href={href} />
    ) : (
      <Link href={href} />
    )
  ) : undefined;
  const look = variant === 'primary' ? 'primary' : 'outline';
  if (showLabel && name) {
    return (
      <Button
        variant={look}
        className={cn(BUTTON_TEXT, className)}
        title={title && title !== name ? title : iconOnlyOnPhone ? name : undefined}
        aria-label={iconOnlyOnPhone ? name : undefined}
        disabled={disabled}
        onClick={onClick}
        render={render}
        ref={ref}
      >
        <Icon aria-hidden />
        {iconOnlyOnPhone ? <span className="hidden sm:inline">{name}</span> : name}
      </Button>
    );
  }
  return (
    <IconButton
      icon={Icon}
      label={name}
      title={title ?? label}
      variant={look}
      className={className}
      disabled={disabled}
      onClick={onClick}
      render={render}
      ref={ref}
    />
  );
}
