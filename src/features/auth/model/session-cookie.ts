// Better Auth's signed session cookie: value = encodeURIComponent(`${token}.${base64(HMAC-SHA256(secret, token))}`).
// sign-up writes the session rows itself (one db.batch), so it signs the cookie here;
// sign-up.int.test.ts proves Better Auth's getSession accepts it.
const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

export async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return encodeURIComponent(`${value}.${toBase64(mac)}`);
}

export type SessionCookie = { name: string; value: string; maxAgeSec: number; secure: boolean };

/** A Set-Cookie header value: HttpOnly, SameSite=Lax, Secure when the app URL is https. */
export function serializeSessionCookie(c: SessionCookie): string {
  return `${c.name}=${c.value}; Max-Age=${c.maxAgeSec}; Path=/; HttpOnly${
    c.secure ? '; Secure' : ''
  }; SameSite=Lax`;
}
