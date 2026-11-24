'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The request's CSP nonce (proxy.ts), for the few things that add a <style> or <script> in the
// browser themselves (Tiptap's editor styles). Undefined outside a request, as in the tests.
const NonceContext = createContext<string | undefined>(undefined);

export function NonceProvider({ nonce, children }: { nonce?: string; children: ReactNode }) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;
}

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
