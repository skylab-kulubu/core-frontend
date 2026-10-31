'use client';

import { cn, useControlSize, type ControlSize } from '@skylab-kulubu/skylcn-ui';
import type { SelectHTMLAttributes } from 'react';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  /** sm 32px, md 36px or lg 38px, as skylcn-ui's Input; a ControlSizeProvider above sets it too. */
  size?: ControlSize;
};

const HEIGHT = {
  sm: 'h-8 rounded-md pointer-coarse:h-10',
  md: 'h-9 rounded-lg pointer-coarse:h-11',
  lg: 'h-9.5 rounded-lg px-3 text-sm pointer-coarse:h-11.5',
} as const;

/** A native select dressed like skylcn-ui's Input: the same heights, fill and focus ring. */
export function Select({ className = '', children, size, ...props }: SelectProps) {
  const box = useControlSize(size);
  return (
    <select
      {...props}
      data-size={box}
      className={cn(
        'border-input bg-background/60 text-foreground w-full min-w-0 border px-2.5 text-xs outline-hidden pointer-coarse:text-base',
        'ease-enter transition-[border-color,box-shadow,background-color] duration-(--motion-duration-fast)',
        'hover:border-border-strong focus-visible:border-skylab-600/60 focus-visible:ring-skylab-600/25 focus-visible:ring-2',
        'aria-invalid:border-destructive/50 aria-invalid:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
        HEIGHT[box],
        className,
      )}
    >
      {children}
    </select>
  );
}
