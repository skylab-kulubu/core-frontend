'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { waffleAppIsCurrent, waffleApps } from '@/lib/waffle';

export function WaffleMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={labelId}
        aria-label="Uygulamalar"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {open ? (
        <div
          id={labelId}
          role="menu"
          className={`absolute top-full z-50 mt-2 w-56 rounded-lg border border-white/10 bg-neutral-950 p-2 shadow-xl ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <ul className="grid grid-cols-3 gap-1">
            {waffleApps().map((app) => {
              const current = origin !== '' && waffleAppIsCurrent(app.href, origin);
              return (
                <li key={app.id}>
                  <a
                    role="menuitem"
                    href={app.href}
                    className={`flex min-h-16 flex-col items-center justify-center rounded-md px-1 py-2 text-center text-[11px] ${
                      current
                        ? 'bg-skylab-500/15 text-skylab-300'
                        : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100'
                    }`}
                  >
                    {app.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
