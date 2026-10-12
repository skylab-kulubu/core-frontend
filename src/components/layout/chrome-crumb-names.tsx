'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { chromeCrumbKey, type ChromeCrumbNames } from '@/lib/chrome-breadcrumbs';

type SetCrumbName = (href: string, name: string | null) => void;

const NamesContext = createContext<ChromeCrumbNames>({});
const SetNameContext = createContext<SetCrumbName | null>(null);

/** Holds the names pages give their records, so the trail says "GeceKodu" instead of "Kayıt". */
export function ChromeCrumbNamesProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<ChromeCrumbNames>({});
  const setName = useCallback<SetCrumbName>((href, name) => {
    const key = chromeCrumbKey(href);
    setNames((current) => {
      if (name ? current[key] === name : !(key in current)) return current;
      const next = { ...current };
      if (name) next[key] = name;
      else delete next[key];
      return next;
    });
  }, []);
  return (
    <SetNameContext.Provider value={setName}>
      <NamesContext.Provider value={names}>{children}</NamesContext.Provider>
    </SetNameContext.Provider>
  );
}

export function useChromeCrumbNames(): ChromeCrumbNames {
  return useContext(NamesContext);
}

/** Names the crumb at `href` while the calling page is open; no name keeps the default label. */
export function useChromeCrumbName(href: string, name: string | null | undefined): void {
  const setName = useContext(SetNameContext);
  const label = name?.trim() || null;
  useEffect(() => {
    if (!setName || !label) return;
    setName(href, label);
    return () => setName(href, null);
  }, [setName, href, label]);
}
