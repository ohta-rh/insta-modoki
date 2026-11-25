import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { checkUsername } from './check-username';

const t = useTestDb();

describe('checkUsername', () => {
  it('大文字小文字が違うだけの username のとき available が false になる', async () => {
    await createUser(t.db, { username: 'haru' });
    expect(await checkUsername({ username: 'HaRu' }, { env: { DB: t.d1 as never } })).toEqual({
      available: false,
    });
  });

  it('使われていない username のとき available が true になる', async () => {
    expect(await checkUsername({ username: 'mio' }, { env: { DB: t.d1 as never } })).toEqual({
      available: true,
    });
  });

  it('形式が不正または予約語のとき VALIDATION を返す', async () => {
    for (const username of ['.abc', 'ab', 'admin']) {
      const err = await checkUsername({ username }, { env: { DB: t.d1 as never } }).catch((e) => e);
      expect(err, username).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VALIDATION');
      expect((err as AppError).fieldErrors?.username).toHaveLength(1);
    }
  });

  it('同じ IP の 31 回目の呼び出しが RATE_LIMITED になり 別の IP は影響を受けない', async () => {
    const env = { DB: t.d1 as never };
    // Fixed clock: the fixed-window count must not depend on when the test runs.
    const now = Date.UTC(2026, 0, 1, 0, 0, 30);
    const ip = (a: string) => new Headers({ 'cf-connecting-ip': a });
    for (let i = 0; i < 30; i += 1) {
      await checkUsername({ username: 'mio' }, { env, headers: ip('203.0.113.5'), now });
    }
    const err = await checkUsername(
      { username: 'mio' },
      { env, headers: ip('203.0.113.5'), now },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('RATE_LIMITED');
    expect((err as AppError).retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(
      await checkUsername({ username: 'mio' }, { env, headers: ip('203.0.113.6'), now }),
    ).toEqual({
      available: true,
    });
  });
});
