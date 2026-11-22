/**
 * Whether this image talks to the sandbox. The workflow bakes the core address
 * in at build time (sandbox-api.… for sandbox, `next dev` forwards
 * /sandbox-api/*), so the address alone tells the two images apart.
 */
export function isSandbox(apiUrl: string = process.env.NEXT_PUBLIC_API_URL ?? ''): boolean {
  try {
    const url = new URL(apiUrl);
    return /^sandbox[-.]/.test(url.hostname) || url.pathname.startsWith('/sandbox-api');
  } catch {
    return false;
  }
}
