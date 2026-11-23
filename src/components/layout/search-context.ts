'use client';

import { createContext, useContext } from 'react';

/** Opens the panel's search; provided by AdminSearch, which holds the palette. */
export const SearchContext = createContext<(() => void) | null>(null);

/** Opens the search from anywhere in the chrome, such as a not-found page; null outside it. */
export function useOpenSearch(): (() => void) | null {
  return useContext(SearchContext);
}
