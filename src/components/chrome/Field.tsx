import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement>;

export function Field({ className = '', ...props }: FieldProps) {
  return (
    <input
      {...props}
      className={`focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-xs text-neutral-100 placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none ${className}`}
    />
  );
}
