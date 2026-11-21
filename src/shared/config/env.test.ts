import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.ts';

describe('loadEnv', () => {
  it('未設定のとき、PORT は 3000、APP_ENV は local になる', () => {
    expect(loadEnv({})).toEqual({ port: 3000, appEnv: 'local' });
  });

  it('PORT が 65535 のとき通る', () => {
    expect(loadEnv({ PORT: '65535' }).port).toBe(65535);
  });

  it('PORT が 1 のとき通る', () => {
    expect(loadEnv({ PORT: '1' }).port).toBe(1);
  });

  it('PORT が 65536 のとき投げる', () => {
    expect(() => loadEnv({ PORT: '65536' })).toThrow('環境変数の設定が不正です: PORT');
  });

  it('PORT が 0 のとき投げる', () => {
    expect(() => loadEnv({ PORT: '0' })).toThrow('環境変数の設定が不正です: PORT');
  });

  it('PORT が abc のとき投げる', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow('環境変数の設定が不正です: PORT');
  });

  it('PORT が 3001.5 のとき投げる', () => {
    expect(() => loadEnv({ PORT: '3001.5' })).toThrow('環境変数の設定が不正です: PORT');
  });

  it('APP_ENV が production のとき通る', () => {
    expect(loadEnv({ APP_ENV: 'production' }).appEnv).toBe('production');
  });

  it('APP_ENV が test のとき通る', () => {
    expect(loadEnv({ APP_ENV: 'test' }).appEnv).toBe('test');
  });

  it('APP_ENV が staging のとき投げる', () => {
    expect(() => loadEnv({ APP_ENV: 'staging' })).toThrow('環境変数の設定が不正です: APP_ENV');
  });

  it('両方が不正なとき、両方の名前を含めて投げる', () => {
    expect(() => loadEnv({ PORT: 'abc', APP_ENV: 'x' })).toThrow(
      '環境変数の設定が不正です: PORT, APP_ENV',
    );
  });
});
