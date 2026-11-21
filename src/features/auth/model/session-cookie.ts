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

/**
 * The session token in a Cookie header, or null when the cookie is missing, malformed or its
 * signature does not match (so a forged value never reaches the database).
 */
export async function readSessionToken(
  cookieHeader: string | null,
  name: string,
  secret: string,
): Promise<string | null> {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
    const dot = decoded.lastIndexOf('.');
    if (dot < 1) return null;
    const token = decoded.slice(0, dot);
    const expected = decodeURIComponent(await signCookieValue(token, secret));
    return expected === decoded ? token : null;
  }
  return null;
}
