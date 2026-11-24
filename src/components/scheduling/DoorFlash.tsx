'use client';

import { cn } from '@skylab-kulubu/skylcn-ui';
import { CircleCheck, CircleX, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DoorSignal } from '@/lib/door-feedback';

export type DoorFlashResult = {
  signal: DoorSignal;
  title: string;
  /** The holder's name, a reason, or empty. */
  line: string;
  /** The entry's time ("09:06"), when there is one. */
  time?: string;
};

const ICONS = { in: CircleCheck, already: Clock, refused: CircleX } as const;

/**
 * A code's result over the whole screen for a moment (Eventbrite Organizer, Tito, Luma):
 * green for an entry, amber for "already in", red for a refusal, each with its own icon and
 * words, so the colour is never the only sign. A tap closes it early. Screen readers hear the
 * result band under it, so this layer is hidden from them. Without motion when reduced motion
 * is asked for. Drawn on the body, so no transformed parent of the page can shrink it.
 */
export function DoorFlash({
  result,
  onClose,
}: {
  result: DoorFlashResult | null;
  onClose: () => void;
}) {
  // Rises in from slightly smaller on the next frame; still when motion is reduced
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!result) {
      setShown(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  if (!result) return null;
  const Icon = ICONS[result.signal];
  return createPortal(
    <div
      aria-hidden
      data-testid="door-flash"
      data-signal={result.signal}
      data-shown={shown}
      onClick={onClose}
      className={cn(
        'text-background fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-4 px-6 text-center',
        'transition duration-150 ease-out motion-reduce:transition-none',
        'data-[shown=false]:scale-[0.97] data-[shown=false]:opacity-0 motion-reduce:data-[shown=false]:scale-100 motion-reduce:data-[shown=false]:opacity-100',
        result.signal === 'in' && 'bg-success',
        result.signal === 'already' && 'bg-warning',
        result.signal === 'refused' && 'bg-destructive',
      )}
    >
      <Icon className="size-28 shrink-0 sm:size-36" strokeWidth={2.25} />
      <p className="text-4xl leading-tight font-bold tracking-tight sm:text-6xl">{result.title}</p>
      {result.line ? (
        <p className="max-w-[22ch] text-2xl leading-snug font-semibold break-words sm:text-4xl">
          {result.line}
        </p>
      ) : null}
      {result.time ? (
        <p className="text-xl font-medium tabular-nums opacity-80 sm:text-2xl">{result.time}</p>
      ) : null}
    </div>,
    document.body,
  );
}
