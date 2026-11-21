import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { accounts, sessions, users } from '../../../shared/db/schema';
import { verifyPassword } from '../model/password';
import { getSessionUser } from './session-user';
import { signUp } from './sign-up';

const t = useTestDb();
const env = () => testAuthEnv(t.d1);
const input = (over: Record<string, unknown> = {}) => ({
  email: 'haru@example.com',
  username: 'haru',
  displayName: 'Haru',
  password: crypto.randomUUID(),
  ...over,
});
const ipHeaders = (ip: string) => new Headers({ 'cf-connecting-ip': ip });

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}

const rowCounts = async () => ({
  users: (await t.db.select({ n: count() }).from(users))[0]!.n,
  accounts: (await t.db.select({ n: count() }).from(accounts))[0]!.n,
  sessions: (await t.db.select({ n: count() }).from(sessions))[0]!.n,
});

describe('signUp', () => {
  it('username が使われているとき CONFLICT を返し行を増やさない', async () => {
    await createUser(t.db, { username: 'haru', email: 'other@example.com' });
    const before = await rowCounts();
    const e = await rejection(() =>
      signUp(input({ username: 'HARU' }), { env: env(), headers: new Headers() }),
    );
    expect(e.code).toBe('CONFLICT');
    expect(e.fieldErrors).toEqual({ username: ['このユーザー名は使われています'] });
    expect(await rowCounts()).toEqual(before);
  });

  it('email が登録済みのとき CONFLICT を返し行を増やさない', async () => {
    await createUser(t.db, { username: 'someone', email: 'haru@example.com' });
    const before = await rowCounts();
    const e = await rejection(() =>
      signUp(input({ email: 'Haru@Example.com' }), { env: env(), headers: new Headers() }),
    );
    expect(e.code).toBe('CONFLICT');
    expect(e.fieldErrors).toEqual({ email: ['このメールアドレスは登録済みです'] });
    expect(await rowCounts()).toEqual(before);
  });

  it('username と email の両方が使われているとき 両方の項目に出る', async () => {
    await createUser(t.db, { username: 'haru', email: 'haru@example.com' });
    const e = await rejection(() => signUp(input(), { env: env(), headers: new Headers() }));
    expect(Object.keys(e.fieldErrors ?? {}).sort()).toEqual(['email', 'username']);
  });

  it('パスワードの平文を保存せず Cookie に HttpOnly Secure SameSite=Lax を付ける', async () => {
    const e = env();
    const password = crypto.randomUUID();
    const result = await signUp(input({ password }), { env: e, headers: new Headers() });
    expect(result.username).toBe('haru');
    expect(Object.keys(result).sort()).toEqual(['cookie', 'setCookie', 'username']);

    const attrs = result.setCookie.split('; ');
    expect(attrs).toEqual(
      expect.arrayContaining(['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000', 'Path=/']),
    );
    expect(attrs[0]).toMatch(/^__Secure-better-auth\.session_token=/);

    const dump = JSON.stringify([
      await t.db.select().from(users),
      await t.db.select().from(accounts),
      await t.db.select().from(sessions),
    ]);
    expect(dump).not.toContain(password);
    const [account] = await t.db.select().from(accounts);
    expect(account!.providerId).toBe('credential');
    expect(account!.password).toMatch(/^pbkdf2-sha256-hmac\$100000\$/);
    expect(await verifyPassword(password, account!.password!, e.AUTH_PEPPER)).toBe(true);

    // Better Auth accepts the cookie we signed.
    const headers = new Headers({ cookie: `${result.cookie.name}=${result.cookie.value}` });
    const user = await getSessionUser(headers, { env: e });
    const [row] = await t.db.select().from(users).where(eq(users.username, 'haru'));
    expect(user).toEqual({ id: row!.id, username: 'haru' });
  });

  it('入力を小文字・前後の空白除去にして保存する', async () => {
    await signUp(input({ username: 'Ab1', email: ' Ab@Example.COM ', displayName: '  Ab  ' }), {
      env: env(),
      headers: new Headers(),
    });
    const [row] = await t.db.select().from(users);
    expect(row).toMatchObject({ username: 'ab1', email: 'ab@example.com', displayName: 'Ab' });
  });

  it('入力が不正なとき VALIDATION を返し行を増やさない', async () => {
    const e = await rejection(() =>
      signUp(input({ username: '.abc', password: 'short' }), {
        env: env(),
        headers: new Headers(),
      }),
    );
    expect(e.code).toBe('VALIDATION');
    expect(Object.keys(e.fieldErrors ?? {}).sort()).toEqual(['password', 'username']);
    expect(await rowCounts()).toEqual({ users: 0, accounts: 0, sessions: 0 });
  });

  it('同じ IP の 11 回目のサインアップが RATE_LIMITED になる', async () => {
    const e = env();
    // Fixed clock: the fixed-window count must not depend on when the test runs.
    const now = Date.UTC(2026, 0, 1, 0, 30, 0);
    for (let i = 0; i < 10; i += 1) {
      await signUp(input({ username: `user${i}x`, email: `u${i}@example.com` }), {
        env: e,
        headers: ipHeaders('203.0.113.1'),
        now,
      });
    }
    const err = await rejection(() =>
      signUp(input({ username: 'user11x', email: 'u11@example.com' }), {
        env: e,
        headers: ipHeaders('203.0.113.1'),
        now,
      }),
    );
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterSec).toBeGreaterThanOrEqual(1);
    const other = await signUp(input({ username: 'user12x', email: 'u12@example.com' }), {
      env: e,
      headers: ipHeaders('203.0.113.2'),
      now,
    });
    expect(other.username).toBe('user12x');
  });

  it('同じ内容を同時に送っても 1 行だけできる', async () => {
    const e = env();
    const results = await Promise.allSettled([
      signUp(input(), { env: e, headers: new Headers() }),
      signUp(input(), { env: e, headers: new Headers() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(AppError);
    expect((failed.reason as AppError).code).toBe('CONFLICT');
    expect(await rowCounts()).toEqual({ users: 1, accounts: 1, sessions: 1 });
  });
});

describe('sessionHeadersFor', () => {
  it('作った Cookie でログイン中の利用者が分かる', async () => {
    const e = env();
    const u = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, e, u);
    expect(await getSessionUser(headers, { env: e })).toEqual({ id: u.id, username: u.username });
  });
});
