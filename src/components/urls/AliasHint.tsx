'use client';

import { useEffect, useState } from 'react';
import { urlsApi, type AliasAvailability } from '@/lib/api/urls';
import { aliasHint, shouldCheckAlias, type AliasHint as Hint } from '@/lib/short-links';

/** How long typing must pause before the alias is checked. */
export const ALIAS_CHECK_DELAY_MS = 350;

/**
 * The hint for a typed alias, from core's availability check after a pause in
 * typing. Only the latest typed value counts; an empty alias, the link's own
 * alias while editing, or a failed check give no hint.
 */
export function useAliasHint(
  value: string,
  mode: 'create' | 'edit',
  currentAlias?: string,
): Hint | null {
  const alias = value.trim();
  const check = shouldCheckAlias(alias, currentAlias);
  const [answer, setAnswer] = useState<{ alias: string; result: AliasAvailability } | null>(null);

  useEffect(() => {
    if (!check) return;
    let live = true;
    const timer = setTimeout(() => {
      urlsApi.availability(alias).then(
        (result) => {
          if (live) setAnswer({ alias, result });
        },
        () => {
          if (live) setAnswer(null);
        },
      );
    }, ALIAS_CHECK_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [alias, check]);

  if (!check || answer?.alias !== alias) return null;
  return aliasHint(answer.result, mode);
}

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
