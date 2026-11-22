'use client';

import { useEffect, useState } from 'react';

/** A design direction on trial, chosen by `?tasarim=a|b`; null keeps today's screen. */
export type DesignVariant = 'a' | 'b';

export function designVariantOf(search: string): DesignVariant | null {
  const value = new URLSearchParams(search).get('tasarim');
  return value === 'a' || value === 'b' ? value : null;
}

/**
 * The direction the address asks for. Read after mount, so the server render
 * and the first client render agree; the trial switch goes once one is chosen.
 */
export function useDesignVariant(): DesignVariant | null {
  const [variant, setVariant] = useState<DesignVariant | null>(null);
  useEffect(() => {
    setVariant(designVariantOf(window.location.search));
  }, []);
  return variant;
}
