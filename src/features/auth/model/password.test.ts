import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

const pepper = crypto.randomUUID() + crypto.randomUUID();
const pw = crypto.randomUUID();

describe('hashPassword', () => {
  it('pbkdf2-sha256-hmac$100000$<salt>$<hash> の形で平文を含まない', async () => {
    const h = await hashPassword(pw, pepper);
    const [scheme, iter, salt, hash, ...rest] = h.split('$');
    expect(scheme).toBe('pbkdf2-sha256-hmac');
    expect(iter).toBe('100000');
    expect(atob(salt!)).toHaveLength(16);
    expect(atob(hash!)).toHaveLength(32);
    expect(rest).toEqual([]);
    expect(h).not.toContain(pw);
  });

  it('同じパスワードでもソルトが違うので毎回違う値になる', async () => {
    expect(await hashPassword(pw, pepper)).not.toBe(await hashPassword(pw, pepper));
  });
});

describe('verifyPassword', () => {
  it('正しいパスワードのとき true', async () => {
    expect(await verifyPassword(pw, await hashPassword(pw, pepper), pepper)).toBe(true);
  });

  it('違うパスワードのとき false', async () => {
    expect(await verifyPassword(pw + 'x', await hashPassword(pw, pepper), pepper)).toBe(false);
  });

  it('pepper が違うとき false', async () => {
    expect(await verifyPassword(pw, await hashPassword(pw, pepper), pepper + 'x')).toBe(false);
  });

  it('保存した値の反復を使って検証する', async () => {
    const h = await hashPassword(pw, pepper, { iterations: 1000 });
    expect(h.split('$')[1]).toBe('1000');
    expect(await verifyPassword(pw, h, pepper)).toBe(true);
  });

  it('形式が不正な値のとき 例外でなく false', async () => {
    for (const bad of [
      '',
      'x',
      'scrypt$1$a$b',
      'pbkdf2-sha256-hmac$abc$AA==$AA==',
      'pbkdf2-sha256-hmac$0$AA==$AA==',
      'pbkdf2-sha256-hmac$100000$***$***',
      'pbkdf2-sha256-hmac$99999999$AA==$AA==',
    ]) {
      expect(await verifyPassword(pw, bad, pepper), bad).toBe(false);
    }
  });
});
