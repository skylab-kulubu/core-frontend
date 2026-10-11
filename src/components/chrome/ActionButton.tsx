'use client';

import { IconButton } from '@skylab-kulubu/skylcn-ui';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

type ActionButtonProps = {
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  label?: string;
  variant?: 'ghost' | 'primary';
  className?: string;
  title?: string;
  disabled?: boolean;
};

/** A square icon action in a toolbar or row; a link when it has `href`. */
export function ActionButton({
  href,
  onClick,
  icon = ChevronRight,
  label,
  variant = 'ghost',
  className,
  title,
  disabled,
}: ActionButtonProps) {
  const name = label ?? title ?? '';
  const render = href ? (
    /^https?:\/\//.test(href) ? (
      <a href={href} />
    ) : (
      <Link href={href} />
    )
  ) : undefined;
  return (
    <IconButton
      icon={icon}
      label={name}
      title={title ?? label}
      variant={variant === 'primary' ? 'primary' : 'outline'}
      className={className}
      disabled={disabled}
      onClick={onClick}
      render={render}
    />
  );
}
