import { useEffect, useRef, useState } from 'react';
import { identityApi, type Person } from '@/lib/api/identity';

/** The directory is searched, never listed whole: a picker asks once this many characters are typed. */
export const PERSON_SEARCH_MIN = 2;
export const PERSON_SEARCH_HINT = 'En az 2 karakter yazın';

export function personSearchReady(query: string): boolean {
  return query.trim().length >= PERSON_SEARCH_MIN;
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
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;
  const ready = personSearchReady(query);

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
