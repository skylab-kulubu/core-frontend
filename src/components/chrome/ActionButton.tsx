'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

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

export function ActionButton({
  href,
  onClick,
  icon: Icon,
  label,
  variant = 'ghost',
  className = '',
  title,
  disabled,
}: ActionButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'border-skylab-400/40 bg-skylab-500/10 text-skylab-300 hover:border-skylab-300/60 hover:bg-skylab-400/20'
      : 'border-white/10 bg-transparent text-neutral-200 hover:border-white/20 hover:bg-white/5';
  const buttonClass = `inline-flex h-8 w-8 items-center justify-center rounded-md border text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylab-400/40 ${variantClass} ${className}`;

  if (href) {
    const external = /^https?:\/\//.test(href);
    if (external) {
      return (
        <a href={href} className={buttonClass} aria-label={label ?? title} title={title ?? label}>
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </a>
      );
    }
    return (
      <Link href={href} className={buttonClass} aria-label={label ?? title} title={title ?? label}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${buttonClass} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      aria-label={label ?? title}
      title={title ?? label}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
    </button>
  );
}
