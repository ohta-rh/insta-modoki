// pbkdf2-sha256-hmac$<iterations>$<salt b64>$<hash b64>, where hash = HMAC-SHA256(AUTH_PEPPER, PBKDF2 output)
// (ADR-0020). Web Crypto only, so it runs on Workers; comparison is crypto.subtle.verify (constant time).
const SCHEME = 'pbkdf2-sha256-hmac';
export const PBKDF2_ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;
const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (s: string): Uint8Array<ArrayBuffer> | null => {
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

const hmacKey = (pepper: string, usage: 'sign' | 'verify') =>
  crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ]);

export async function hashPassword(
  password: string,
  pepper: string,
  options: { iterations?: number } = {},
): Promise<string> {
  const iterations = options.iterations ?? PBKDF2_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt, iterations);
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(pepper, 'sign'), derived),
  );
  return [SCHEME, iterations, toBase64(salt), toBase64(mac)].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
  pepper: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== SCHEME || !/^\d+$/.test(parts[1]!)) return false;
  const iterations = Number(parts[1]);
  if (iterations < 1 || iterations > MAX_ITERATIONS) return false;
  const salt = fromBase64(parts[2]!);
  const mac = fromBase64(parts[3]!);
  if (!salt || !mac || salt.length === 0 || mac.length !== 32) return false;
  const derived = await derive(password, salt, iterations);
  return crypto.subtle.verify('HMAC', await hmacKey(pepper, 'verify'), mac, derived);
}
