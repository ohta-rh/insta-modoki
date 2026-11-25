import { describe, expect, it, vi } from 'vitest';
import { assertTestDatabaseName, useTestDb } from './db';

describe('useTestDb', () => {
  it('名前が _test で終わらない DB には接続しない', () => {
    vi.stubEnv('TEST_DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/insta_s1');
    expect(() => useTestDb()).toThrow('テスト用ではない DB には接続しません: insta_s1');
    vi.unstubAllEnvs();
  });

  it.each(['insta_s1_test', 'insta_s1_test_2'])('%s は通る', (name) => {
    expect(() => assertTestDatabaseName(`postgres://u:p@127.0.0.1:5432/${name}`)).not.toThrow();
  });
});
