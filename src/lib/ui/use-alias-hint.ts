import { useEffect, useState } from 'react';
import { urlsApi, type AliasAvailability } from '@/lib/api/urls';
import { aliasHint, shouldCheckAlias, type AliasHint, type AliasHintMode } from '@/lib/short-links';

/** How long typing must pause before the alias is checked. */
export const ALIAS_CHECK_DELAY_MS = 350;

/**
 * The hint for a typed alias, from core's availability check after a pause in
 * typing. Only the latest value counts; an empty alias, the link's own alias
 * (`currentAlias`), or a failed check give no hint.
 */
export function useAliasHint(
  value: string,
  mode: AliasHintMode,
  currentAlias?: string,
): AliasHint | null {
  const alias = value.trim();
  const check = shouldCheckAlias(alias, currentAlias);
  const [answer, setAnswer] = useState<{ alias: string; result: AliasAvailability } | null>(null);

  useEffect(() => {
    if (!check) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      urlsApi
        .availability(alias)
        .then((result) => {
          if (!cancelled) setAnswer({ alias, result });
        })
        .catch(() => {
          if (!cancelled) setAnswer(null);
        });
    }, ALIAS_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [alias, check]);

  if (!check || answer?.alias !== alias) return null;
  return aliasHint(answer.result, mode);
}
