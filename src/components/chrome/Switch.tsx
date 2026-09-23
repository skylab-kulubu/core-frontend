'use client';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
};

export function Switch({ checked, onChange, label, hint }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/3 px-3 py-2.5 text-left hover:bg-white/5"
    >
      <SwitchTrack checked={checked} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm text-neutral-200">{label}</span>
        {hint ? <span className="text-3xs mt-0.5 block text-neutral-500">{hint}</span> : null}
      </span>
    </button>
  );
}

/** The on/off track and knob, for switches that label themselves elsewhere (e.g. a table cell). */
export function SwitchTrack({ checked, className = '' }: { checked: boolean; className?: string }) {
  return (
    <span
      className={`relative block h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-skylab-500' : 'bg-white/15'
      } ${className}`}
    >
      <span
        className={`absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </span>
  );
}
