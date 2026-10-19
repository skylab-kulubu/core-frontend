import { useEffect, useRef, useState } from 'react';
import { identityApi, type Person } from '@/lib/api/identity';

/** The directory is searched, never listed whole: a picker asks once this many characters are typed. */
export const PERSON_SEARCH_MIN = 2;
export const PERSON_SEARCH_HINT = 'En az 2 karakter yazın';
/** A Group's member candidates need one more (core answers a shorter query 400). */
export const MEMBER_CANDIDATE_MIN = 3;
export const MEMBER_CANDIDATE_HINT = `En az ${MEMBER_CANDIDATE_MIN} karakter yazın`;

export function personSearchReady(query: string, min = PERSON_SEARCH_MIN): boolean {
  return query.trim().length >= min;
}

/**
 * Debounced people search for pickers. Nothing is fetched while the picker is
 * closed or the query is shorter than PERSON_SEARCH_MIN.
 */
export function usePersonSearch(
  open: boolean,
  query: string,
  search: (query: string) => Promise<Person[]> = identityApi.listUsers,
) {
  return usePickerSearch(open, query, search, PERSON_SEARCH_MIN);
}

/**
 * Debounced search for pickers. Nothing is fetched while the picker is
 * closed or the query is shorter than `min` characters.
 */
export function usePickerSearch<T>(
  open: boolean,
  query: string,
  search: (query: string) => Promise<T[]>,
  min: number,
) {
  const [people, setPeople] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;
  const ready = personSearchReady(query, min);

  useEffect(() => {
    setPeople([]);
    setFailed(false);
    if (!open || !ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = window.setTimeout(() => {
      searchRef
        .current(query)
        .then((rows) => {
          if (!cancelled) setPeople(rows);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, ready]);

  return { people, loading, failed, ready };
}
