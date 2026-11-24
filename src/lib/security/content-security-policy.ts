import { cdnOrigin } from '@/lib/event-media';
import { isSandbox } from '@/lib/environment';

/**
 * The panel's Content Security Policy, the Account center's pattern (Next.js' nonce guide):
 * proxy.ts mints a nonce per request, Next puts it on its own scripts, and 'strict-dynamic'
 * lets those load the chunks they need. Nothing else runs: no inline script, no eval in the
 * image, no plugin, no <base>, and no other site may frame the panel.
 *
 * Report-only by default: the browser keeps the page working and only reports (console and
 * /api/csp-report). CSP_ENFORCE=true (the container's env, read at runtime) makes it binding.
 */
export const CSP_ENFORCE_ENV = 'CSP_ENFORCE';
export const CSP_REPORT_PATH = '/api/csp-report';

export type CspHeaderName = 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only';

export function cspHeaderName(value = process.env[CSP_ENFORCE_ENV]): CspHeaderName {
  return value === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

/** Presigned addresses of the media storage: Direct upload parts (PUT) and private read links. */
export const MEDIA_STORAGE_ORIGIN = 'https://*.r2.cloudflarestorage.com';
/** Contributors' pictures in the dashboard's GitHub section. */
export const GITHUB_AVATAR_ORIGIN = 'https://avatars.githubusercontent.com';
/** Core's public media base on the sandbox (its CDN_BASE); production's is the default CDN. */
export const SANDBOX_CDN_ORIGIN = 'https://sandbox-cdn.yildizskylab.com';

function originOf(value: string | undefined): string | null {
  try {
    const origin = new URL(value ?? '').origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export type PolicyOrigins = {
  /** Core: every API call, plus the QR images the panel shows straight from it. */
  api: string | null;
  /** inscribed (the CMS) and the dashboard's GitHub section. */
  otherApis: string[];
  /** Where media is served: the CDN (images, videos, PDFs, map archives). */
  media: string[];
};

/** The origins the browser calls, from the addresses the image was built with (ghcr.yml). */
export function policyOrigins(
  env: Record<string, string | undefined> = process.env,
): PolicyOrigins {
  const apiUrl = env.NEXT_PUBLIC_API_URL;
  return {
    api: originOf(apiUrl),
    otherApis: unique([
      originOf(env.NEXT_PUBLIC_CMS_URL),
      originOf(env.NEXT_PUBLIC_GITHUB_ACTIVITY_URL),
    ]),
    media: unique([
      originOf(cdnOrigin(env.NEXT_PUBLIC_CDN_URL)),
      isSandbox(apiUrl ?? '') ? SANDBOX_CDN_ORIGIN : null,
    ]),
  };
}

export type PolicyOptions = {
  development?: boolean;
  enforce?: boolean;
  origins?: PolicyOrigins;
};

export function contentSecurityPolicy(nonce: string, options: PolicyOptions = {}): string {
  const development = options.development ?? process.env.NODE_ENV === 'development';
  const enforce = options.enforce ?? cspHeaderName() === 'Content-Security-Policy';
  const origins =
    options.origins ??
    policyOrigins({
      // Inlined at build time, so the proxy bundle carries the image's addresses
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_CMS_URL: process.env.NEXT_PUBLIC_CMS_URL,
      NEXT_PUBLIC_GITHUB_ACTIVITY_URL: process.env.NEXT_PUBLIC_GITHUB_ACTIVITY_URL,
      NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    });
  const media = [...origins.media, MEDIA_STORAGE_ORIGIN];
  const list = (...sources: (string | null | false)[]) =>
    unique(sources.map((source) => source || null)).join(' ');

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // React's style props (layout, certificate preview, Base UI's hidden inputs) are attributes:
    // only those run inline; a <style> element still needs the nonce.
    "style-src-attr 'unsafe-inline'",
    `img-src ${list("'self'", 'data:', 'blob:', origins.api, ...media, GITHUB_AVATAR_ORIGIN)}`,
    `media-src ${list("'self'", 'blob:', ...media)}`,
    "font-src 'self'",
    `connect-src ${list("'self'", origins.api, ...origins.otherApis, ...media, development && 'ws:')}`,
    // MapLibre's worker is the panel's own file; the door scanner's QR worker is a blob
    "worker-src 'self' blob:",
    // The certificate editor previews a PDF background in a frame
    `frame-src ${list("'self'", 'blob:', ...media)}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Ignored (with a console warning) in a report-only policy, so only when it binds
    ...(enforce && !development ? ['upgrade-insecure-requests'] : []),
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ');
}
