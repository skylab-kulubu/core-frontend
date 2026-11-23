'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';
import { RouteErrorState } from '@/components/chrome/PageState';

/**
 * A page that threw while drawing: said inside the chrome, with a retry. The error goes
 * to the console for whoever looks; the retry reads the page again from the server too
 * (a server component's error is not cured by drawing it again on the client).
 */
export default function AuthorizedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <RouteErrorState
      onRetry={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
}
