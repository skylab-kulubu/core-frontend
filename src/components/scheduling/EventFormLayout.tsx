'use client';

import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState, type FormEventHandler, type ReactNode } from 'react';
import { EVENT_EDITOR_SECTIONS, type EventEditorSectionId } from './EventEditor';

type EventFormLayoutProps = {
  onSubmit: FormEventHandler<HTMLFormElement>;
  /** Unsaved changes: the bar says so. */
  dirty: boolean;
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
  /** A refused save or a form problem, said in the bar where the button is. */
  error?: ReactNode;
  /** Under the error, such as a link to an event the save created. */
  extra?: ReactNode;
  children: ReactNode;
};

/** The section in view, for the jump list; the first until the page scrolls. */
function useCurrentSection(): EventEditorSectionId {
  const [current, setCurrent] = useState<EventEditorSectionId>(EVENT_EDITOR_SECTIONS[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = EVENT_EDITOR_SECTIONS.find((section) => visible.get(section.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: '-15% 0px -55% 0px' },
    );
    for (const section of EVENT_EDITOR_SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return current;
}

/**
 * The event's create and edit page: the editor's sections with a jump list
 * (beside the form on wide screens, a row above it on phones) and a save bar
 * that stays at the bottom of the screen.
 */
export function EventFormLayout({
  onSubmit,
  dirty,
  saving,
  submitLabel,
  onCancel,
  error,
  extra,
  children,
}: EventFormLayoutProps) {
  const current = useCurrentSection();
  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:gap-10"
    >
      <nav
        aria-label="Bölümler"
        className="bg-background/95 border-border-subtle sticky top-(--skylcn-sticky-top) z-20 -mx-4 mb-6 overflow-x-auto border-b px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:mb-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none"
      >
        <ul className="flex gap-1 py-2 lg:flex-col lg:gap-0.5 lg:py-0">
          {EVENT_EDITOR_SECTIONS.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={current === section.id ? 'location' : undefined}
                className={cn(
                  'block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors',
                  current === section.id
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-3xl min-w-0">
        {children}
        <div className="bg-background/95 border-border-subtle sticky bottom-0 z-20 -mx-4 mt-10 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {error ? (
            <div role="alert" className="text-destructive mb-2 text-sm">
              {error}
            </div>
          ) : null}
          {extra}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn('text-muted-foreground mr-auto text-sm', !dirty && 'invisible')}
              aria-live="polite"
            >
              {dirty ? 'Kaydedilmemiş değişiklik var' : ''}
            </span>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="submit" variant="primary" pending={saving}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
