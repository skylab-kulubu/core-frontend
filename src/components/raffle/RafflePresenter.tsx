'use client';

import { Button, Checkbox } from '@skylab-kulubu/skylcn-ui';
import { Maximize, Minimize, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RaffleEntry } from '@/lib/api/raffles';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';
import { shortRaffleName } from './raffle-copy';

/** What the projector may show of a winner: the name alone, never the e-mail. */
type Shown = Pick<RaffleEntry, 'position' | 'name'>;

const CONTROL = `${BUTTON_TEXT} border-white/20 bg-white/5 text-white hover:bg-white/10`;

/**
 * The winners on a projector: the whole screen, dark, large. A press of Space or Enter, or a
 * click, shows the next winner; "Hepsini göster" shows them all. Alternates are not shown.
 * Escape leaves full screen, and from a window goes back to the result.
 */
export function RafflePresenter({
  title,
  entries,
  backHref,
  onExit,
}: {
  title: string;
  entries: readonly RaffleEntry[];
  backHref: string;
  onExit: () => void;
}) {
  // Only names leave this line: the e-mail never reaches the screen
  const winners: Shown[] = entries
    .filter((entry) => entry.status === 'winner')
    .map((entry) => ({ position: entry.position, name: entry.name }));
  const [revealed, setRevealed] = useState(0);
  const [short, setShort] = useState(false);
  const [full, setFull] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const total = winners.length;

  const next = useCallback(() => setRevealed((last) => Math.min(total, last + 1)), [total]);

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // A focused control answers its own keys
      if (target?.closest('button, a, input, [role="checkbox"]')) return;
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'Escape' && !document.fullscreenElement) {
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, onExit]);

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void stage.current?.requestFullscreen?.();
  }

  const many = total > 6;

  return (
    <div
      ref={stage}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — kazananlar`}
      className="fixed inset-0 z-[200] flex flex-col overflow-y-auto bg-[#0b0a12] text-white"
    >
      <div className="flex flex-wrap items-center justify-end gap-2 p-3 sm:p-4">
        <label className="mr-auto flex items-center gap-2 text-sm text-white/80">
          <Checkbox checked={short} onCheckedChange={(on) => setShort(on)} />
          Adları kısalt
        </label>
        <Button
          className={CONTROL}
          size="sm"
          variant="outline"
          disabled={revealed >= total}
          onClick={() => setRevealed(total)}
        >
          Hepsini göster
        </Button>
        <Button className={CONTROL} size="sm" variant="outline" onClick={toggleFull}>
          {full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          {full ? 'Tam ekrandan çık' : 'Tam ekran'}
        </Button>
        <Button
          className={CONTROL}
          size="sm"
          variant="outline"
          render={<Link href={backHref} />}
          aria-label="Kapat"
        >
          <X aria-hidden />
        </Button>
      </div>

      <div
        className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-8 px-6 pb-10 sm:gap-12"
        onClick={next}
      >
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white/90 sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <ol
          aria-label="Kazananlar"
          className={`grid w-full max-w-6xl gap-4 sm:gap-6 ${many ? 'sm:grid-cols-2' : ''}`}
        >
          {winners.map((winner, index) => {
            const open = index < revealed;
            return (
              <li
                key={winner.position}
                className={`flex items-center gap-4 rounded-2xl border px-5 py-4 sm:gap-6 sm:px-8 sm:py-6 ${
                  open ? 'border-[#a78bfa]/60 bg-[#a78bfa]/10' : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <span className="w-10 shrink-0 text-right text-2xl font-semibold text-white/50 tabular-nums sm:text-4xl">
                  {index + 1}
                </span>
                <span
                  className={`min-w-0 font-semibold break-words ${
                    many ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl lg:text-6xl'
                  } ${open ? 'text-white' : 'text-white/20'}`}
                >
                  {open ? (short ? shortRaffleName(winner.name) : winner.name) : '?'}
                </span>
              </li>
            );
          })}
        </ol>
        {revealed < total ? (
          <p className="text-sm text-white/50">Sıradaki için boşluk ya da tık</p>
        ) : null}
      </div>
    </div>
  );
}
