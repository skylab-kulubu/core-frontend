import type { AliasHint as Hint } from '@/lib/short-links';

const TONES: Record<Hint['tone'], string> = {
  ok: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

/** The one-line availability hint under an alias field; empty while there is none. */
export function AliasHint({
  id,
  hint,
  className,
}: {
  id: string;
  hint: Hint | null;
  className?: string;
}) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={['text-2xs', hint ? TONES[hint.tone] : '', className].filter(Boolean).join(' ')}
    >
      {hint?.text}
    </p>
  );
}
