import { count } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { AppError } from '../../../shared/errors';
import { sessions } from '../../../shared/db/schema';
import { getSessionUser } from './session-user';
import { logIn } from './log-in';
import { signUp } from './sign-up';

const t = useTestDb();
const env = () => testAuthEnv(t.d1);
const ipHeaders = (ip: string, extra: Record<string, string> = {}) =>
  new Headers({ 'cf-connecting-ip': ip, ...extra });
// Rate limits use fixed windows, so every test passes a fixed clock (never the real one).
// Tests that read the session back use the real clock: a session made at NOW is long expired.
const NOW = Date.UTC(2026, 0, 1, 0, 0, 30);
const MISMATCH = 'メールアドレスまたはパスワードが違います';

async function registered(e: ReturnType<typeof env>, email = 'haru@example.com') {
  const password = crypto.randomUUID();
  await signUp(
    { email, username: 'haru', displayName: 'Haru', password },
    { env: e, headers: ipHeaders('198.51.100.9') },
  );
  return { email, password };
}

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}

const sessionCount = async () => (await t.db.select({ n: count() }).from(sessions))[0]!.n;

describe('logIn', () => {
  it('同じ IP から 1 分に 5 回目までは受け付け 6 回目を RATE_LIMITED で拒む', async () => {
    const e = env();
    const now = NOW;
    for (let i = 1; i <= 5; i += 1) {
      const err = await rejection(() =>
        logIn(
          { email: 'nobody@example.com', password: 'x' },
          { env: e, headers: ipHeaders('203.0.113.5'), now },
        ),
      );
      expect(err.code, `${i} 回目`).toBe('UNAUTHENTICATED');
    }
    const sixth = await rejection(() =>
      logIn(
        { email: 'nobody@example.com', password: 'x' },
        { env: e, headers: ipHeaders('203.0.113.5'), now },
      ),
    );
    expect(sixth.code).toBe('RATE_LIMITED');
    expect(sixth.message).toBe('操作が多すぎます。しばらくしてからもう一度お試しください');
    expect(sixth.retryAfterSec).toBeGreaterThanOrEqual(1);

    // Another IP is not affected.
    const other = await rejection(() =>
      logIn(
        { email: 'nobody@example.com', password: 'x' },
        { env: e, headers: ipHeaders('203.0.113.6'), now },
      ),
    );
    expect(other.code).toBe('UNAUTHENTICATED');
  });

  it('1 分が過ぎると同じ IP でも再び試せる', async () => {
    const e = env();
    const now = NOW;
    const attempt = (at: number) =>
      rejection(() =>
        logIn(
          { email: 'nobody@example.com', password: 'x' },
          { env: e, headers: ipHeaders('203.0.113.7'), now: at },
        ),
      );
    for (let i = 0; i < 5; i += 1) await attempt(now);
    expect((await attempt(now)).code).toBe('RATE_LIMITED');
    expect((await attempt(now + 60_000)).code).toBe('UNAUTHENTICATED');
  });

  it('同じメールへの 11 回目の試行は IP が違っても RATE_LIMITED になる', async () => {
    const e = env();
    const now = NOW;
    for (let i = 0; i < 10; i += 1) {
      const err = await rejection(() =>
        logIn(
          { email: 'Victim@Example.com', password: 'x' },
          { env: e, headers: ipHeaders(`192.0.2.${i + 1}`), now },
        ),
      );
      expect(err.code).toBe('UNAUTHENTICATED');
    }
    const err = await rejection(() =>
      logIn(
        { email: 'victim@example.com', password: 'x' },
        { env: e, headers: ipHeaders('192.0.2.99'), now },
      ),
    );
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('パスワードが違うときと未登録のときで同じ UNAUTHENTICATED を返す', async () => {
    const e = env();
    const { email } = await registered(e);
    const wrong = await rejection(() =>
      logIn(
        { email, password: 'wrong-password' },
        { env: e, headers: ipHeaders('203.0.113.1'), now: NOW },
      ),
    );
    const unknown = await rejection(() =>
      logIn(
        { email: 'nobody@example.com', password: 'wrong-password' },
        { env: e, headers: ipHeaders('203.0.113.1'), now: NOW },
      ),
    );
    for (const err of [wrong, unknown]) {
      expect(err.code).toBe('UNAUTHENTICATED');
      expect(err.message).toBe(MISMATCH);
      expect(err.fieldErrors).toBeUndefined();
    }
    expect(await sessionCount()).toBe(1);
  });

  it('メールの大文字小文字が違っても ログインできる', async () => {
    const e = env();
    const { password } = await registered(e);
    const result = await logIn(
      { email: 'HARU@Example.com', password },
      { env: e, headers: ipHeaders('203.0.113.2') },
    );
    const headers = new Headers({ cookie: `${result.cookie.name}=${result.cookie.value}` });
    expect((await getSessionUser(headers, { env: e }))?.username).toBe('haru');
    const attrs = result.setCookie.split('; ');
    expect(attrs).toEqual(
      expect.arrayContaining(['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000', 'Path=/']),
    );
  });

  it('空の入力は VALIDATION で試行回数に数えない', async () => {
    const e = env();
    for (let i = 0; i < 8; i += 1) {
      const err = await rejection(() =>
        logIn({ email: '', password: '' }, { env: e, headers: ipHeaders('203.0.113.3'), now: NOW }),
      );
      expect(err.code).toBe('VALIDATION');
      expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(['email', 'password']);
    }
    const err = await rejection(() =>
      logIn(
        { email: 'nobody@example.com', password: 'x' },
        { env: e, headers: ipHeaders('203.0.113.3'), now: NOW },
      ),
    );
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('ログインのたびに新しい session ができ 持っていた古い Cookie の session は消える', async () => {
    const e = env();
    const { password } = await registered(e);
    const [user] = await t.db.select().from((await import('../../../shared/db/schema')).users);
    const old = await sessionHeadersFor(t.db, e, user!);
    expect(await sessionCount()).toBe(2);
    const result = await logIn(
      { email: 'haru@example.com', password },
      { env: e, headers: ipHeaders('203.0.113.4', { cookie: old.get('cookie')! }) },
    );
    expect(await getSessionUser(old, { env: e })).toBeNull();
    const fresh = new Headers({ cookie: `${result.cookie.name}=${result.cookie.value}` });
    expect((await getSessionUser(fresh, { env: e }))?.username).toBe('haru');
    expect(await sessionCount()).toBe(2);
  });
});
