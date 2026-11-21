export type SecurityHeaderOptions = {
  mediaOrigin: string | null;
  production: boolean;
  /** Per-request nonce for Next.js' inline scripts; added to script-src only when given. */
  nonce?: string;
};

const NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

function buildCsp({ mediaOrigin, production, nonce }: SecurityHeaderOptions): string {
  if (nonce !== undefined && !NONCE.test(nonce)) throw new Error('nonce が不正です');
  const media = mediaOrigin === null ? [] : [mediaOrigin];
  const directives = [
    ['default-src', "'self'"],
    ['script-src', "'self'", ...(nonce === undefined ? [] : [`'nonce-${nonce}'`])],
    // 'unsafe-inline' for styles only: React's style attribute needs it.
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:', 'blob:', ...media],
    ['media-src', "'self'", ...media],
    // The browser PUTs straight to the signed media URL (requestUploadUrls).
    ['connect-src', "'self'", ...media],
    ['font-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
    ...(production ? [['upgrade-insecure-requests']] : []),
  ];
  return directives.map((parts) => parts.join(' ')).join('; ');
}

/** The security headers for one response; every value is a single line. */
export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}

/** Sets the security headers, replacing any value already there (so CSP appears once). */
export function applySecurityHeaders(headers: Headers, options: SecurityHeaderOptions): void {
  for (const [name, value] of Object.entries(buildSecurityHeaders(options))) {
    headers.set(name, value);
  }
}
