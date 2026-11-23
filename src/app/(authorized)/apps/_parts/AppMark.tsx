import { cn } from '@skylab-kulubu/skylcn-ui';
import { appInitials } from './app-view';

/** The app's mark: its initials on a quiet tile (core sends no icon). */
export function AppMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'border-border-subtle bg-skylab-500/10 text-skylab-300 grid shrink-0 place-items-center rounded-lg border font-semibold',
        'size-9 text-xs',
      )}
    >
      {appInitials(name)}
    </span>
  );
}
