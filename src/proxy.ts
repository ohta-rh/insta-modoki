import { NextResponse, type NextRequest } from 'next/server';
import { applySecurityHeaders, readSecurityConfig, type SecurityConfig } from '@/shared/security';

// The environment does not change while the Worker runs, so it is read once.
let securityConfig: SecurityConfig | undefined;

export function proxy(request: NextRequest): NextResponse {
  securityConfig ??= readSecurityConfig(process.env);
  const options = { ...securityConfig, nonce: btoa(crypto.randomUUID()) };

  // Next.js reads the nonce from the request's CSP and puts it on its own inline scripts.
  const requestHeaders = new Headers(request.headers);
  applySecurityHeaders(requestHeaders, options);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response.headers, options);
  return response;
}

// Static files skip the Worker; public/_headers covers them.
export const config = { matcher: '/((?!_next/static|_next/image|favicon.ico).*)' };
