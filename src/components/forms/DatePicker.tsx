'use client';

import {
  DatePicker as CalendarPicker,
  DateTimePicker as CalendarTimePicker,
  Input,
} from '@skylab-kulubu/skylcn-ui';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { useEffect, useId, useState } from 'react';
import {
  formatTypedDate,
  pad2,
  parseDatetimeLocal,
  parseTypedDate,
  toDatetimeLocalValue,
  type DateFieldMode,
} from '@/lib/date-picker';

type DatePickerProps = {
  /** YYYY-MM-DDTHH:mm (a day and a time), or YYYY-MM-DD with `mode="date"`, as the forms store it. */
  value: string;
  onChange: (next: string) => void;
  /** `date` for a day alone, such as a KVKK request's date; a day and a time otherwise. */
  mode?: DateFieldMode;
  /** Kept for the forms that pass it; their schemas check that a value is there. */
  required?: boolean;
  /** Earliest and latest day the calendar offers, as YYYY-MM-DD. */
  min?: string;
  max?: string;
  id?: string;
  /**
   * The field's name above it. The field brings its own label so the calendar
   * button stays out of it: a label around both would name the field after the button too.
   */
  label?: string;
  'aria-label'?: string;
};

/** The calendar button beside the field: the picker's own trigger, icon only. */
const CALENDAR_BUTTON = 'w-9 shrink-0 justify-center px-0 [&>span]:sr-only';

function dayOf(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

function dayValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * The panel's one date field: the day (and time) is typed, as 15.11.2026 19:00,
 * or picked from the calendar beside it. A typed value is taken as soon as it
 * reads as a date; leaving the field with text that does not says so under it.
 */
export function DatePicker({
  value,
  onChange,
  mode = 'datetime',
  min,
  max,
  id,
  label: visibleLabel,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const label = ariaLabel ?? visibleLabel;
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [text, setText] = useState(() => formatTypedDate(value, mode));
  const [invalid, setInvalid] = useState(false);
  const fallbackTime = mode === 'datetime' ? formatTypedDate(value, mode).slice(11) : undefined;

  // A value set from outside (the calendar, a reset) shows in the field
  useEffect(() => {
    if (parseTypedDate(text, mode, fallbackTime || undefined) === value) return;
    setText(formatTypedDate(value, mode));
    setInvalid(false);
    // The text is compared, not followed: typing must not be rewritten under the cursor
  }, [value, mode]);

  function type(next: string) {
    setText(next);
    const parsed = parseTypedDate(next, mode, fallbackTime || undefined);
    if (parsed === null) return;
    setInvalid(false);
    if (parsed !== value) onChange(parsed);
  }

  function settle() {
    const parsed = parseTypedDate(text, mode, fallbackTime || undefined);
    if (parsed === null) {
      setInvalid(Boolean(text.trim()));
      return;
    }
    setText(formatTypedDate(parsed, mode));
  }

  const hintId = `${inputId}-hint`;
  const calendarLabel = label ? `${label}: takvimden seç` : 'Takvimden seç';
  return (
    <div className="space-y-1">
      {visibleLabel ? (
        <label htmlFor={inputId} className="block">
          <FieldLabel>{visibleLabel}</FieldLabel>
        </label>
      ) : null}
      <div className="flex gap-1.5">
        <Input
          id={inputId}
          value={text}
          onChange={(change) => type(change.target.value)}
          onBlur={settle}
          placeholder={mode === 'date' ? 'GG.AA.YYYY' : 'GG.AA.YYYY SS:DD'}
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? hintId : undefined}
          className="min-w-0 flex-1 tabular-nums"
        />
        {mode === 'date' ? (
          <CalendarPicker
            value={dayOf(value) ?? null}
            onValueChange={(date) => onChange(date ? dayValue(date) : '')}
            min={dayOf(min)}
            max={dayOf(max)}
            aria-label={calendarLabel}
            className={CALENDAR_BUTTON}
          />
        ) : (
          <CalendarTimePicker
            value={parseDatetimeLocal(value)}
            onValueChange={(date) => onChange(date ? toDatetimeLocalValue(date) : '')}
            min={dayOf(min)}
            max={dayOf(max)}
            aria-label={calendarLabel}
            className={CALENDAR_BUTTON}
          />
        )}
      </div>
      {invalid ? (
        <p id={hintId} className="text-destructive text-xs">
          {mode === 'date' ? 'GG.AA.YYYY biçiminde yaz.' : 'GG.AA.YYYY SS:DD biçiminde yaz.'}
        </p>
      ) : null}
    </div>
  );
}
