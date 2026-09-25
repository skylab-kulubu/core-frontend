class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}

/**
 * Stands in for next/navigation in server component tests:
 * `jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);`
 * Like Next's own redirect(), it stops rendering by throwing.
 */
export const navigation = {
  redirect(url: string): never {
    throw new RedirectSignal(url);
  },
};

/** Where rendering redirected to, or `null` when it rendered without redirecting. */
export async function redirectTarget(render: () => unknown): Promise<string | null> {
  try {
    await render();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  return null;
}
