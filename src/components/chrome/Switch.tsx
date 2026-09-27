'use client';

import { cn, ToggleRow } from '@skylab-kulubu/skylcn-ui';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
};

/** A labelled on/off row; skylcn-ui's ToggleRow. */
export function Switch({ checked, onChange, label, hint }: SwitchProps) {
  return (
    <ToggleRow checked={checked} onCheckedChange={onChange} title={label} description={hint} />
  );
}

/** The on/off track and knob, for switches that label themselves elsewhere (e.g. a table cell). */
export function SwitchTrack({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'relative block h-5 w-9 shrink-0 rounded-full transition-colors duration-(--motion-duration-fast)',
        checked ? 'bg-skylab-500' : 'bg-border-strong',
        className,
      )}
    >
      <span
        className={cn(
          'ease-enter absolute top-0.5 left-0 size-4 rounded-full bg-white shadow-sm transition-transform duration-(--motion-duration-fast)',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </span>
  );
}
