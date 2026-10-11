import { cn } from '@skylab-kulubu/skylcn-ui';
import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** A native select dressed like skylcn-ui's inputs, for forms that list plain options. */
export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'border-input bg-input-background text-foreground h-8 w-full min-w-0 rounded-md border px-2.5 text-xs outline-hidden',
        'ease-enter transition-[border-color] duration-(--motion-duration-fast) pointer-coarse:h-10 pointer-coarse:text-base',
        'hover:border-border-strong focus-visible:border-skylab-400/50 focus-visible:ring-skylab-400/20 focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {children}
    </select>
  );
}
