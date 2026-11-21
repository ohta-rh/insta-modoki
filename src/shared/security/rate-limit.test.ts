import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../tests/helpers/db';
import { AppError } from '../errors';
import { consume } from './rate-limit';

const T0 = Date.UTC(2026, 10, 21, 12, 0, 0);

async function limited(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('RATE_LIMITED にならなかった');
}

describe('consume', () => {
  const t = useTestDb();

  it('上限ちょうどまで受け付け 1 回超えると RATE_LIMITED を返す', async () => {
    for (let i = 0; i < 10; i += 1) {
      await consume('signup:ip:1.2.3.4', 10, 3600, 1, { db: t.db, now: T0 + i });
    }
    const e = await limited(() =>
      consume('signup:ip:1.2.3.4', 10, 3600, 1, { db: t.db, now: T0 + 11 }),
    );
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.message).toBe('操作が多すぎます。しばらくしてからもう一度お試しください');
    expect(e.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('retryAfterSec が窓の終わりまでの秒数になる', async () => {
    const now = T0 + 1_000 * 3000; // 窓の始まりから 3000 秒後
    await consume('k', 1, 3600, 1, { db: t.db, now });
    const e = await limited(() => consume('k', 1, 3600, 1, { db: t.db, now }));
    expect(e.retryAfterSec).toBe(600);
  });

  it('別のキーは影響を受けない', async () => {
    await consume('signup:ip:a', 1, 3600, 1, { db: t.db, now: T0 });
    await limited(() => consume('signup:ip:a', 1, 3600, 1, { db: t.db, now: T0 }));
    await expect(
      consume('signup:ip:b', 1, 3600, 1, { db: t.db, now: T0 }),
    ).resolves.toBeUndefined();
  });

  it('窓が過ぎると再び受け付ける', async () => {
    await consume('k', 1, 3600, 1, { db: t.db, now: T0 });
    await limited(() => consume('k', 1, 3600, 1, { db: t.db, now: T0 + 1000 }));
    await expect(
      consume('k', 1, 3600, 1, { db: t.db, now: T0 + 3600 * 1000 }),
    ).resolves.toBeUndefined();
  });

  it('cost の分だけ数が増え 上限を超える cost は拒む', async () => {
    await consume('upload:user:u', 300, 3600, 200, { db: t.db, now: T0 });
    await consume('upload:user:u', 300, 3600, 100, { db: t.db, now: T0 });
    await limited(() => consume('upload:user:u', 300, 3600, 1, { db: t.db, now: T0 }));
    await limited(() => consume('upload:user:big', 300, 3600, 301, { db: t.db, now: T0 }));
  });

  it('同時に呼んでも 上限を超えた分は拒まれる', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 15 }, () => consume('race', 10, 3600, 1, { db: t.db, now: T0 })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(5);
  });
});
