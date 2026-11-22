import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobs, runAll } from './index';
import type { Job, JobEnv } from './types';

afterEach(() => vi.restoreAllMocks());

const env = {} as JobEnv;
const NOW = new Date('2026-11-22T00:00:00.000Z');

describe('jobs', () => {
  it('登録順は storage-orphans-retry、story-cleanup、notification-cleanup', () => {
    expect(Object.keys(jobs)).toEqual([
      'storage-orphans-retry',
      'story-cleanup',
      'notification-cleanup',
    ]);
  });
});

describe('runAll with the registered jobs', () => {
  const stub = (deleted: number) => vi.fn<Job>(async () => ({ deleted }));

  it('notification-cleanup を最後に登録し、runAll が全てを実行する', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const names = Object.keys(jobs);
    expect(names.at(-1)).toBe('notification-cleanup');
    const fakes = Object.fromEntries(names.map((n, i) => [n, stub(i)]));
    await runAll(env, NOW, { jobs: fakes });
    for (const fake of Object.values(fakes)) expect(fake).toHaveBeenCalledOnce();
    expect(log.mock.calls.map((c) => c[0])).toEqual(names.map((n, i) => `${n}: deleted=${i}`));
  });

  it('notification-cleanup が失敗しても名前だけを報告する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const names = Object.keys(jobs);
    const fakes: Record<string, Job> = Object.fromEntries(names.map((n) => [n, stub(1)]));
    fakes['notification-cleanup'] = async () => {
      throw new Error(
        'D1_ERROR: no such table: notifications: SELECT id FROM notifications at /app/x.ts',
      );
    };
    const failure = await runAll(env, NOW, { jobs: fakes }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    for (const n of names.slice(0, -1)) expect(fakes[n]).toHaveBeenCalledOnce();
    expect(failure!.message).toBe('ジョブが失敗しました: notification-cleanup');
    expect(failure!.message).not.toMatch(/D1_ERROR|SELECT|\/app/);
  });
});

describe('runAll', () => {
  it('成功したジョブの件数を 1 行ずつログに出す', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const a: Job = async () => ({ deleted: 2 });
    const b: Job = async () => ({ deleted: 0 });
    await runAll(env, NOW, { jobs: { a, b } });
    expect(log.mock.calls).toEqual([['a: deleted=2'], ['b: deleted=0']]);
  });

  it('1 つのジョブが失敗しても他を実行し、失敗を内部の情報なしで報告する', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const second = vi.fn<Job>(async () => ({ deleted: 1 }));
    const first: Job = async () => {
      throw new Error('D1_ERROR: no such table: stories: SELECT id FROM stories at /app/x.ts');
    };

    const failure = await runAll(env, NOW, { jobs: { first, second } }).then(
      () => null,
      (e: unknown) => e as Error,
    );

    expect(second).toHaveBeenCalledOnce();
    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toBe('ジョブが失敗しました: first');
    expect(error.mock.calls).toEqual([['job failed', 'first', 'Error']]);
    const seen = JSON.stringify([error.mock.calls, failure!.message]);
    expect(seen).not.toMatch(/D1_ERROR|SELECT|\/app/);
  });

  it('失敗が複数なら名前を 、 でつなぐ', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad: Job = async () => {
      throw 'x';
    };
    await expect(runAll(env, NOW, { jobs: { p: bad, q: bad } })).rejects.toThrow(
      'ジョブが失敗しました: p、q',
    );
  });
});
