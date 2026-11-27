'use client';

import { useEffect, useState } from 'react';
import { rafflesApi, type RaffleCriteria, type RafflePreview } from '@/lib/api/raffles';
import { raffleProblemMessage } from './raffle-copy';

/** How long the form rests before core is asked again. */
export const RAFFLE_PREVIEW_DEBOUNCE_MS = 300;

export type RafflePreviewState = {
  /** The last answer, kept while the next one is on its way. */
  preview: RafflePreview | null;
  loading: boolean;
  /** core's refusal in the panel's words. */
  error: string | null;
};

/**
 * Who the criteria take, asked of core once the form has rested for
 * RAFFLE_PREVIEW_DEBOUNCE_MS; an earlier question still out is dropped. `criteria` null
 * (the form is not valid yet) asks nothing.
 */
export function useRafflePreview(eventId: string, criteria: RaffleCriteria | null) {
  const [state, setState] = useState<RafflePreviewState>({
    preview: null,
    loading: criteria !== null,
    error: null,
  });
  // The criteria as text: a new object with the same values asks nothing new
  const key = criteria ? JSON.stringify(criteria) : null;

  useEffect(() => {
    if (key === null) {
      setState((last) => ({ ...last, loading: false }));
      return;
    }
    const asked = JSON.parse(key) as RaffleCriteria;
    const abort = new AbortController();
    setState((last) => ({ ...last, loading: true }));
    const timer = setTimeout(() => {
      rafflesApi.preview(eventId, asked, abort.signal).then(
        (preview) => {
          if (!abort.signal.aborted) setState({ preview, loading: false, error: null });
        },
        (err: unknown) => {
          if (abort.signal.aborted) return;
          setState({
            preview: null,
            loading: false,
            error: raffleProblemMessage(err, 'Uygun kişiler okunamadı'),
          });
        },
      );
    }, RAFFLE_PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [eventId, key]);

  return state;
}
