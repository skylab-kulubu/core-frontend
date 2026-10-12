import { cn } from '@skylab-kulubu/skylcn-ui';

/**
 * An event's cover at full size: a 16:9 frame (the shape of skylcn's PageHeader cover) that shows
 * the whole picture, whatever its shape. A banner fills it; a square or a poster sits in the middle
 * on the muted ground instead of being cut to a strip.
 */
export function EventCoverImage({ src, className }: { src: string; className?: string }) {
  return (
    <div
      data-slot="event-cover"
      className={cn(
        'border-border bg-muted aspect-video w-full overflow-hidden rounded-lg border',
        className,
      )}
    >
      <img src={src} alt="" className="size-full object-contain" />
    </div>
  );
}
