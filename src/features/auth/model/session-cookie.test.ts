import { describe, expect, it } from 'vitest';
import { readSessionToken, serializeSessionCookie, signCookieValue } from './session-cookie';

const secret = crypto.randomUUID();

describe('signCookieValue', () => {
  it('token.署名 を URL エンコードした値を返し 署名は HMAC-SHA256 の base64', async () => {
    const v = await signCookieValue('tok', secret);
    const [token, sig] = decodeURIComponent(v).split('.');
    expect(token).toBe('tok');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('tok')),
    );
    expect(sig).toBe(btoa(String.fromCharCode(...mac)));
  });
});

describe('serializeSessionCookie', () => {
  it('HttpOnly と SameSite=Lax と Max-Age と Path を付け secure のとき Secure を付ける', () => {
    const base = { name: 'n', value: 'v', maxAgeSec: 2592000, secure: true };
    const s = serializeSessionCookie(base);
    expect(s).toBe('n=v; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax');
    expect(serializeSessionCookie({ ...base, secure: false })).not.toContain('Secure');
  });
});

describe('readSessionToken', () => {
  const name = '__Secure-better-auth.session_token';

  it('署名が合う Cookie から token を取り出す', async () => {
    const value = await signCookieValue('tok.en-1', secret);
    expect(await readSessionToken(`a=b; ${name}=${value}; c=d`, name, secret)).toBe('tok.en-1');
  });

  it('Cookie が無い 署名が違う 形が壊れているときは null を返す', async () => {
    const value = await signCookieValue('tok', secret);
    expect(await readSessionToken(null, name, secret)).toBeNull();
    expect(await readSessionToken('a=b', name, secret)).toBeNull();
    expect(await readSessionToken(`${name}=${value}`, name, `${secret}x`)).toBeNull();
    expect(await readSessionToken(`${name}=%E0%A4%A`, name, secret)).toBeNull();
    expect(await readSessionToken(`${name}=nodot`, name, secret)).toBeNull();
  });
});
