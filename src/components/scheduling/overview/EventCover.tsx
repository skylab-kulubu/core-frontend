import { cn, CoverImage } from '@skylab-kulubu/skylcn-ui';
import { eventInitials } from '@/lib/event-overview';

/** An event without a cover: its initials on the brand ground, in the cover's place. */
export function CoverPlaceholder({
  name,
  className,
  size = 'md',
}: {
  name: string;
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div
      data-slot="event-cover-placeholder"
      aria-hidden
      className={cn(
        'border-border-subtle from-skylab-500/45 via-skylab-600/20 to-card text-skylab-300 flex items-center justify-center rounded-lg border bg-linear-to-br font-semibold tracking-wide select-none',
        size === 'lg' ? 'text-5xl' : 'text-2xl',
        className,
      )}
    >
      {eventInitials(name)}
    </div>
  );
}

/**
 * The cover in a 16:9 frame, never cut: a square or tall poster sits whole in the middle on a
 * blurred copy of itself (skylcn-ui CoverImage). Without a cover, the initials take the frame.
 */
export function CoverFrame({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  if (!src) return <CoverPlaceholder name={name} className={cn('aspect-video', className)} />;
  return (
    <CoverImage
      src={src}
      alt=""
      loading="eager"
      className={cn('border-border-subtle rounded-lg border', className)}
    />
  );
}

/**
 * The cover in its own shape: a banner stays wide, a square or a poster stays tall, all of it
 * shown. Without a cover, a square of the initials.
 */
export function CoverNatural({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  if (!src) {
    return <CoverPlaceholder name={name} size="lg" className={cn('aspect-square', className)} />;
  }
  return (
    <img
      src={src}
      alt=""
      data-slot="event-cover"
      className={cn(
        'border-border-subtle block h-auto w-full rounded-xl border object-contain shadow-lg shadow-black/20',
        className,
      )}
    />
  );
}

/** A blurred, faint copy of the cover behind a header: the cover's colours without its detail. */
export function CoverGlow({ src }: { src?: string }) {
  if (!src) {
    return (
      <div
        aria-hidden
        className="from-skylab-500/15 pointer-events-none absolute inset-0 bg-linear-to-b to-transparent"
      />
    );
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        className="size-full scale-125 object-cover opacity-30 blur-3xl saturate-150"
      />
      <div className="to-background absolute inset-0 bg-linear-to-b from-transparent" />
    </div>
  );
}
