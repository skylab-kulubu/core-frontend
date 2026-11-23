import { cn } from '@skylab-kulubu/skylcn-ui';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { progressText, type SeasonProgress } from './season-view';

/** How much of the season is gone: a thin bar and "57. gün / 246" (or "Bitti", "12 gün sonra başlar"). */
export function SeasonBar({
  progress,
  compact = false,
}: {
  progress: SeasonProgress;
  /** In a list row: the bar and the words on one line. */
  compact?: boolean;
}) {
  const percent =
    progress.phase === 'running' ? progress.percent : progress.phase === 'ended' ? 100 : 0;
  const text = progressText(progress);
  return (
    <span
      className={cn('flex min-w-0 gap-2', compact ? 'items-center' : 'flex-col')}
      data-slot="season-bar"
    >
      <span
        role="progressbar"
        aria-label="Sezonun geçen kısmı"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={text}
        className={cn(
          'bg-muted block h-1.5 overflow-hidden rounded-full',
          compact ? 'w-20 shrink-0' : 'w-full',
        )}
      >
        <span
          className={cn(
            'block h-full rounded-full',
            progress.phase === 'ended' ? 'bg-subtle-foreground/60' : 'bg-skylab-400',
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={cn('text-secondary-foreground truncate tabular-nums', TEXT_SECONDARY)}>
        {text}
      </span>
    </span>
  );
}
