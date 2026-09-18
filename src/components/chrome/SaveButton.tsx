import type { ButtonHTMLAttributes } from 'react';

export const saveClass =
  'border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 inline-flex h-8 items-center gap-2 rounded-md border px-3 font-medium hover:border-skylab-300/60 hover:bg-skylab-400/20 disabled:cursor-not-allowed disabled:opacity-60';

export function SaveButton({
  className = '',
  children,
  type = 'submit',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`${saveClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
