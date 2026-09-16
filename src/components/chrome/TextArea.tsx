import type { TextareaHTMLAttributes } from 'react';

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = '', ...props }: TextAreaProps) {
  return (
    <textarea
      {...props}
      className={`focus:border-skylab-400/50 w-full rounded-md border border-white/10 bg-white/3 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none ${className}`}
    />
  );
}
