'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ChevronsRight } from 'lucide-react';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px]"
        aria-label="Paneli kapat"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={onClose}
          className="group relative flex h-full w-5 flex-col items-center justify-center rounded-l-full border-y border-l border-neutral-800 bg-[#121212] text-neutral-500 hover:text-neutral-300"
          title="Paneli kapat"
        >
          <ChevronsRight size={14} strokeWidth={2.5} />
        </button>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="h-full w-[min(92vw,420px)] overflow-y-auto border-y border-r border-neutral-800 bg-[#121212] p-5 shadow-2xl"
        >
          <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
          <div className="mt-4 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
