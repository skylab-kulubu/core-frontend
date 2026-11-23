import { Badge } from '@skylab-kulubu/skylcn-ui';
import { isSandbox } from '@/lib/environment';

/**
 * A thin band across the top of every page in the sandbox, so no one works in
 * the wrong one; production draws nothing. It sits over the page and takes no
 * clicks. Under the top bar it is the line alone (the bar carries the badge);
 * on a page without the bar (the door) it hangs its own "Sandbox" tab.
 */
export function EnvironmentStrip({ withLabel = true }: { withLabel?: boolean }) {
  if (!isSandbox()) return null;
  return (
    <div
      role={withLabel ? 'note' : undefined}
      aria-label={withLabel ? 'Ortam: Sandbox' : undefined}
      aria-hidden={withLabel ? undefined : true}
      className="pointer-events-none fixed inset-x-0 top-0 z-60 flex justify-center"
    >
      <div className="bg-warning absolute inset-x-0 top-0 h-0.5" />
      {withLabel ? (
        <span className="bg-warning text-background rounded-b-md px-2.5 pb-0.5 text-xs leading-4 font-semibold">
          Sandbox
        </span>
      ) : null}
    </div>
  );
}

/** The environment in the top bar, beside the account: drawn only in the sandbox. */
export function EnvironmentBadge() {
  if (!isSandbox()) return null;
  return (
    <span role="note" aria-label="Ortam: Sandbox" className="shrink-0">
      <Badge tone="warning" className="text-xs">
        Sandbox
      </Badge>
    </span>
  );
}
