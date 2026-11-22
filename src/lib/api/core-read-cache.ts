import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';

/**
 * core's GET answers, kept briefly in the page's memory. The sidebar, the event's workspace and
 * the door's context each read the same event and the same door list; moving between pages reads
 * the same lists again. Here those reads share one request while it runs, and its answer for
 * CORE_READ_MAX_AGE_MS after.
 *
 * Every write through coreFetch (POST, PUT, PATCH, DELETE) drops all kept answers, so a page that
 * reloads after a save reads core again. So do coming back to the tab or window (another tab or
 * another person may have changed something) and a renewed session token (its groups may differ).
 * A read that must not come from here (polling) passes `cache: 'no-store'`.
 */
export const CORE_READ_MAX_AGE_MS = 30_000;

export type CoreAnswer = { status: number; text: string };

type Kept = { at: number; answer: Promise<CoreAnswer> };

const kept = new Map<string, Kept>();

/** Drops every kept answer; reads that are still running finish for their callers only. */
export function clearCoreReads(): void {
  kept.clear();
}

/**
 * The answer for `key`: the running or recent read's, else a new `read()`. Only a 2xx answer is
 * kept; a failed read is tried again by the next caller.
 */
export function keptRead(key: string, read: () => Promise<CoreAnswer>): Promise<CoreAnswer> {
  const now = Date.now();
  const hit = kept.get(key);
  if (hit && now - hit.at < CORE_READ_MAX_AGE_MS) return hit.answer;
  const entry: Kept = { at: now, answer: read() };
  kept.set(key, entry);
  const drop = () => {
    if (kept.get(key) === entry) kept.delete(key);
  };
  entry.answer.then((answer) => {
    if (answer.status < 200 || answer.status >= 300) drop();
  }, drop);
  return entry.answer;
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', clearCoreReads);
  window.addEventListener(SESSION_RENEWED_EVENT, clearCoreReads);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') clearCoreReads();
  });
}
