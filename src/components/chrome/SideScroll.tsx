'use client';

import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { cn } from '@skylab-kulubu/skylcn-ui';

type Fade = 'none' | 'start' | 'end' | 'both';

function fadeOf(el: HTMLElement): Fade {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 1) return 'none';
  const atStart = el.scrollLeft <= 1;
  const atEnd = el.scrollLeft >= max - 1;
  if (atStart) return 'end';
  if (atEnd) return 'start';
  return 'both';
}

/**
 * A row that scrolls sideways when it does not fit (pills on a phone) and fades the edge that
 * still hides content, so the reader sees there is more.
 */
export function SideScroll({ className, children, ...props }: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<Fade>('none');
  const update = useCallback(() => {
    if (ref.current) setFade(fadeOf(ref.current));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  return (
    <div
      {...props}
      ref={ref}
      onScroll={update}
      data-fade={fade}
      className={cn(
        'max-w-full overflow-x-auto',
        'data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]',
        'data-[fade=end]:[mask-image:linear-gradient(to_left,transparent,black_1.5rem)]',
        'data-[fade=start]:[mask-image:linear-gradient(to_right,transparent,black_1.5rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
