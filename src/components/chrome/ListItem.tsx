'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

type ListItemProps = {
  href?: string;
  onSelect?: () => void;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function ListItem({
  href,
  onSelect,
  title,
  subtitle,
  leading,
  trailing,
  className = '',
}: ListItemProps) {
  const row = (
    <div className={`group/row relative transition-colors hover:bg-white/3 ${className}`}>
      {href ? (
        <Link href={href} className="absolute inset-0 z-0" aria-label={title} tabIndex={-1} />
      ) : onSelect ? (
        <button
          type="button"
          className="absolute inset-0 z-0"
          aria-label={title}
          onClick={onSelect}
        />
      ) : null}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-200 transition-colors group-hover/row:text-neutral-50">
            {title}
          </p>
          {subtitle ? (
            <p className="text-3xs mt-0.5 truncate text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="relative z-10 flex items-center gap-1">
          {trailing}
          {href || onSelect ? (
            <span className="group-hover/row:text-skylab-300 inline-flex h-6 w-6 items-center justify-center text-neutral-400 transition-colors">
              <ChevronRight className="h-4 w-4 transition-transform group-hover/row:translate-x-0.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
  return row;
}
