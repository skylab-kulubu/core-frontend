import { isSandbox } from '@/lib/environment';

/**
 * A thin band across the top of every page in the sandbox, so no one works in
 * the wrong one; production draws nothing. It sits over the page and takes no
 * clicks.
 */
export function EnvironmentStrip() {
  if (!isSandbox()) return null;
  return (
    <div
      role="note"
      aria-label="Ortam: Sandbox"
      className="pointer-events-none fixed inset-x-0 top-0 z-60 flex justify-center"
    >
      <div className="bg-warning absolute inset-x-0 top-0 h-0.5" />
      <span className="bg-warning text-background rounded-b-md px-2.5 pb-0.5 text-xs leading-4 font-semibold">
        Sandbox
      </span>
    </div>
  );
}
