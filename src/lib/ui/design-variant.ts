'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** A design direction on trial, chosen by `?tasarim=a|b`; null keeps today's screen. */
export type DesignVariant = 'a' | 'b';

export function designVariantOf(search: string): DesignVariant | null {
  const value = new URLSearchParams(search).get('tasarim');
  return value === 'a' || value === 'b' ? value : null;
}

/** A link that keeps the direction on trial, so moving between pages stays in it. */
export function withDesignVariant(href: string, variant: DesignVariant | null): string {
  if (!variant) return href;
  const [path, hash] = href.split('#');
  const joined = `${path}${path.includes('?') ? '&' : '?'}tasarim=${variant}`;
  return hash === undefined ? joined : `${joined}#${hash}`;
}

/**
 * The direction the address asks for. Read after mount (and on each page change), so the
 * server render and the first client render agree; the trial switch goes once one is chosen.
 */
export function useDesignVariant(): DesignVariant | null {
  const pathname = usePathname();
  const [variant, setVariant] = useState<DesignVariant | null>(null);
  useEffect(() => {
    setVariant(designVariantOf(window.location.search));
  }, [pathname]);
  return variant;
}
