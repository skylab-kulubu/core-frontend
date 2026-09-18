import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement>;

function isTemporal(type?: string) {
  return type === 'date' || type === 'time' || type === 'datetime-local';
}

export function Field({ className = '', type, ...props }: FieldProps) {
  const temporal = isTemporal(type);
  const surface = temporal
    ? 'scheme-light bg-[#f5f1ec] text-[#1a1a1a] placeholder:text-neutral-500 focus:bg-white'
    : 'bg-white/3 text-neutral-100 placeholder:text-neutral-600 focus:bg-white/5';
  return (
    <input
      type={type}
      {...props}
      className={`focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 px-3 text-xs focus:outline-none ${surface} ${className}`}
    />
  );
}
