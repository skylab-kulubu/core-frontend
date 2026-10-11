'use client';

import { DateTimePicker } from '@skylab-kulubu/skylcn-ui';
import { parseDatetimeLocal, toDatetimeLocalValue } from '@/lib/date-picker';

type DatePickerProps = {
  /** A datetime-local value, YYYY-MM-DDTHH:mm, as the forms store it. */
  value: string;
  onChange: (next: string) => void;
  /** Kept for the forms that pass it; their schemas check that a value is there. */
  required?: boolean;
  'aria-label'?: string;
};

/** A day and a time for event and season forms; skylcn-ui's DateTimePicker on string values. */
export function DatePicker({ value, onChange, 'aria-label': label }: DatePickerProps) {
  return (
    <DateTimePicker
      value={parseDatetimeLocal(value)}
      onValueChange={(date) => onChange(date ? toDatetimeLocalValue(date) : '')}
      placeholder="Tarih ve saat"
      aria-label={label}
    />
  );
}
