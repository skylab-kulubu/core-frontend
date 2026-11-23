'use client';

import { RouteErrorState } from '@/components/chrome/PageState';

/** A page that threw while drawing: said inside the chrome, with a retry. */
export default function AuthorizedError({ reset }: { error: Error; reset: () => void }) {
  return <RouteErrorState onRetry={reset} />;
}
