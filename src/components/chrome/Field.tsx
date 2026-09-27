import { Input } from '@skylab-kulubu/skylcn-ui';
import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement>;

/** A text, number, date or search input; skylcn-ui's Input under the name the pages use. */
export function Field({ className = '', ...props }: FieldProps) {
  return <Input {...props} className={className} />;
}
