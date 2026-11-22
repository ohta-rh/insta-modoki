import { describe, expect, it, vi } from 'vitest';
import { runJobCli } from '../src/jobs/cli';
import type { Job, JobEnv } from '../src/jobs/types';

const env = {} as JobEnv;
const NOW = new Date('2026-11-22T00:00:00.000Z');

function run(argv: string[], jobs: Record<string, Job>) {
  const out: string[] = [];
  const err: string[] = [];
  return runJobCli(argv, {
    env,
    now: NOW,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    jobs,
  }).then((code) => ({ code, out, err }));
}

describe('runJobCli', () => {
  it('ジョブ名を受け取って実行し、結果を標準出力に書く', async () => {
    const job = vi.fn<Job>(async () => ({ deleted: 4 }));
    const r = await run(['story-cleanup'], { 'story-cleanup': job });
    expect(r).toEqual({ code: 0, out: ['story-cleanup: deleted=4'], err: [] });
    expect(job).toHaveBeenCalledWith({ env, now: NOW });
  });

  it('知らない名前は 2 で終わる', async () => {
    const jobs = { a: async () => ({ deleted: 0 }), b: async () => ({ deleted: 0 }) };
    const unknown = await run(['nope'], jobs);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toEqual(['知らないジョブです: nope', '登録済みのジョブ: a, b']);
    expect(unknown.out).toEqual([]);
    const none = await run([], jobs);
    expect(none.code).toBe(2);
    expect(none.err).toEqual(['知らないジョブです: ', '登録済みのジョブ: a, b']);
  });

  it('ジョブが失敗すると 1 で終わる', async () => {
    const bad: Job = async () => {
      throw new Error('D1_ERROR: secret detail');
    };
    const r = await run(['bad'], { bad });
    expect(r).toEqual({ code: 1, out: [], err: ['bad: 失敗しました'] });
  });
});
