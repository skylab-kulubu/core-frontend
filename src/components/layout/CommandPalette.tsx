'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  buildSidebarNavigation,
  type SidebarNavigationContext,
} from '@/lib/navigation/sidebar-nav';
import { useBackgroundInert } from '@/lib/ui/use-background-inert';
import { useBodyScrollLock } from '@/lib/ui/use-body-scroll-lock';
import { isTopModalLayer, registerModalLayer } from '@/lib/ui/modal-layer';
import type { UserDto } from '@/types/api';

type Destination = { href: string; label: string; group: string };

function destinationsFor(
  user: UserDto,
  navigationContext: SidebarNavigationContext,
): Destination[] {
  return buildSidebarNavigation(user, navigationContext).flatMap((node) =>
    node.kind === 'link'
      ? [{ href: node.href, label: node.label, group: 'Genel' }]
      : node.children.map((item) => ({ ...item, group: node.label })),
  );
}

export function CommandPalette({
  user,
  enableShortcut = true,
  navigationContext = {},
}: {
  user: UserDto;
  enableShortcut?: boolean;
  navigationContext?: SidebarNavigationContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const listboxId = useId();
  useBodyScrollLock(open);
  useBackgroundInert(open, overlayRef);

  const destinations = useMemo(
    () => destinationsFor(user, navigationContext),
    [navigationContext, user],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return destinations;
    return destinations.filter((item) =>
      `${item.group} ${item.label}`.toLocaleLowerCase('tr-TR').includes(needle),
    );
  }, [destinations, query]);

  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function navigate(destination: Destination) {
    router.push(destination.href);
    close();
  }

  useEffect(() => {
    if (!open) return;
    return registerModalLayer(titleId);
  }, [open, titleId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        if (
          !enableShortcut ||
          (target instanceof HTMLElement &&
            (target.matches('input, textarea, select') || target.isContentEditable))
        ) {
          return;
        }
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === 'Escape' && open) {
        if (!isTopModalLayer(titleId)) return;
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableShortcut, open, titleId]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open, query]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hızlı git"
        className="focus-visible:ring-skylab-400/40 ml-auto inline-flex h-8 items-center gap-2 rounded-md border border-white/10 bg-white/3 px-2.5 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Hızlı git</span>
        <span className="hidden rounded border border-white/10 px-1 py-0.5 font-mono text-[9px] text-neutral-500 lg:inline">
          ⌘K
        </span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={overlayRef}
              className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
            >
              <button
                type="button"
                aria-label="Hızlı git penceresini kapat"
                onClick={close}
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
              />
              <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab') return;
                  const focusable = Array.from(
                    dialogRef.current?.querySelectorAll<HTMLElement>(
                      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
                    ) ?? [],
                  );
                  if (!focusable.length) return;
                  const first = focusable[0];
                  const last = focusable.at(-1)!;
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                  }
                }}
                className="relative w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl"
              >
                <h2 id={titleId} className="sr-only">
                  Hızlı git
                </h2>
                <div className="flex items-center gap-3 border-b border-white/10 px-4">
                  <Command className="text-skylab-300 h-4 w-4" />
                  <input
                    ref={searchRef}
                    type="search"
                    role="combobox"
                    aria-label="Sayfa ara"
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    aria-expanded="true"
                    aria-activedescendant={
                      filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined
                    }
                    placeholder="Sayfa veya işlem ara…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveIndex((index) => Math.max(index - 1, 0));
                      } else if (event.key === 'Enter' && filtered[activeIndex]) {
                        event.preventDefault();
                        navigate(filtered[activeIndex]);
                      }
                    }}
                    className="h-12 min-w-0 flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
                  />
                  <span className="text-3xs text-neutral-600">ESC</span>
                </div>
                <p className="sr-only" aria-live="polite">
                  {filtered.length} sonuç
                </p>
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label="Hedefler"
                  className="max-h-[min(55vh,420px)] overflow-y-auto p-2"
                >
                  {filtered.length ? (
                    filtered.map((item, index) => (
                      <button
                        key={item.href}
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => navigate(item)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          index === activeIndex
                            ? 'bg-skylab-500/10 text-neutral-100'
                            : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {item.label}
                        </span>
                        <span className="text-3xs shrink-0 text-neutral-600">{item.group}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-8 text-center text-sm text-neutral-500">
                      Eşleşen sayfa yok.
                    </p>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
