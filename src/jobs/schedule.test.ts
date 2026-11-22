import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { experimental_readRawConfig } from 'wrangler';
import { runAll } from './index';
import { DAILY_CRON, onScheduled } from './scheduled';
import type { JobEnv } from './types';

vi.mock('./index', () => ({ runAll: vi.fn(async () => {}) }));
afterEach(() => vi.clearAllMocks());

const env = {} as JobEnv;

describe('Cron Trigger の配線', () => {
  it('cron の式と入口が設定と一致する', () => {
    const { rawConfig } = experimental_readRawConfig({ config: 'wrangler.jsonc' });
    expect(rawConfig.main).toBe('src/worker.mjs');
    expect(rawConfig.triggers).toEqual({ crons: ['0 18 * * *'] });
    expect(rawConfig.triggers?.crons).toEqual([DAILY_CRON]);

    const entry = readFileSync('src/worker.mjs', 'utf8');
    expect(entry).toContain("from '../.open-next/worker.js'");
    expect(entry).toMatch(/scheduled:\s*\(controller, env\) => onScheduled\(controller, env\)/);
    // No way to start a job over HTTP in production.
    expect(entry).not.toContain('__scheduled');
  });

  it('DAILY_CRON のとき scheduledTime を now として runAll を 1 回呼ぶ', async () => {
    const scheduledTime = Date.parse('2026-11-22T18:00:00.000Z');
    await onScheduled({ cron: DAILY_CRON, scheduledTime }, env);
    expect(runAll).toHaveBeenCalledExactlyOnceWith(env, new Date(scheduledTime));
  });

  it('知らない式では何も実行しない', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await onScheduled({ cron: '* * * * *', scheduledTime: 0 }, env);
    expect(runAll).not.toHaveBeenCalled();
    expect(error.mock.calls).toEqual([['unknown cron']]);
    error.mockRestore();
  });
});
