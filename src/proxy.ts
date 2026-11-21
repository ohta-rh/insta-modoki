import { NextResponse, type NextRequest } from 'next/server';
import { applySecurityHeaders, readSecurityConfig } from '@/shared/security';

export function proxy(request: NextRequest): NextResponse {
  const options = { ...readSecurityConfig(process.env), nonce: btoa(crypto.randomUUID()) };

  // Next.js reads the nonce from the request's CSP and puts it on its own inline scripts.
  const requestHeaders = new Headers(request.headers);
  applySecurityHeaders(requestHeaders, options);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response.headers, options);
  return response;
}

// Every path runs through here. A static file that exists is served by Workers Static Assets
// without the Worker, so public/_headers covers it; only the 404 for a missing file reaches this proxy.
export const config = { matcher: '/:path*' };
