'use client';

import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useMobileSidebar } from './MobileSidebarContext';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  const sidebar = useMobileSidebar();

  return (
    <div className={`border-b border-white/10 pb-6 ${className ?? ''}`}>
      <div
        className={`flex items-start gap-3 ${actions ? 'sm:items-center sm:justify-between' : ''}`}
      >
        {sidebar?.open ? (
          <button
            type="button"
            onClick={() => (sidebar.isOpen ? sidebar.close() : sidebar.open())}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-neutral-200 hover:bg-white/5 lg:hidden"
            aria-label={sidebar.isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-medium text-neutral-100">{title}</h1>
          {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
