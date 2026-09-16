import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-xs text-neutral-100 focus:bg-white/5 focus:outline-none ${className}`}
    >
      {children}
    </select>
  );
}
