'use client';

import { cn, CoverImage } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useState } from 'react';

/** Whether a picture failed to load; reset when its address changes. */
function useBroken(src?: string) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return [broken, () => setBroken(true)] as const;
}

/** A thing without a picture: its initials on the brand ground, in the picture's place. */
export function CoverPlaceholder({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <div
      data-slot="object-cover-placeholder"
      aria-hidden
      className={cn(
        'border-border-subtle from-skylab-500/45 via-skylab-600/20 to-card text-skylab-300 flex items-center justify-center rounded-lg border bg-linear-to-br text-2xl font-semibold tracking-wide select-none',
        className,
      )}
    >
      {initials}
    </div>
  );
}

/**
 * The picture in a 16:9 frame, never cut: a square or tall poster sits whole in the middle on a
 * blurred copy of itself (skylcn-ui CoverImage). Without a picture, or when it cannot be
 * loaded, the initials take the frame.
 */
export function CoverFrame({
  src,
  initials,
  className,
}: {
  src?: string;
  initials: string;
  className?: string;
}) {
  const [broken, markBroken] = useBroken(src);
  if (!src || broken) {
    return <CoverPlaceholder initials={initials} className={cn('aspect-video', className)} />;
  }
  // A picture that cannot be loaded falls back to the initials (img errors reach this wrapper)
  return (
    <div onError={markBroken} className={cn('shrink-0', className)}>
      <CoverImage
        src={src}
        alt=""
        loading="eager"
        className="border-border-subtle w-full rounded-lg border shadow-md shadow-black/20"
      />
    </div>
  );
}

/**
 * The ground of a page's top band: a blurred copy of the picture for its colours, under a
 * half-clear layer of the page colour so the text on it reads as on the page, in light and dark
 * alike. Without a picture, a flat brand tint.
 */
export function CoverBackdrop({ src }: { src?: string }) {
  const [broken, markBroken] = useBroken(src);
  return (
    <div
      aria-hidden
      data-slot="object-cover-backdrop"
      className="pointer-events-none absolute inset-0"
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          onError={markBroken}
          className="size-full scale-125 object-cover blur-3xl saturate-150"
        />
      ) : (
        <div className="bg-skylab-500/10 size-full" />
      )}
      <div className="bg-background/75 absolute inset-0" />
    </div>
  );
}
