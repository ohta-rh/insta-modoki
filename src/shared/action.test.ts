import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from './errors';

const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`);
});
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND_PAGE');
});
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-test': '1' }) }));

const { failure, formFailure, logUnexpected, run } = await import('./action');

afterEach(() => vi.restoreAllMocks());

describe('failure / run', () => {
  it('AppError のとき ログを出さずにエラー本文を返す', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = failure('x', new AppError('FORBIDDEN'));
    expect(result).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'この操作はできません' },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('想定外のエラーのとき 名前だけをログに出し 固定のメッセージを返す', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = failure('x', new TypeError('secret sql'));
    expect(result.error.code).toBe('INTERNAL');
    expect(spy).toHaveBeenCalledWith('x failed', 'TypeError');
  });

  it('logUnexpected は Error でない値を unknown として出す', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logUnexpected('y', 'boom');
    expect(spy).toHaveBeenCalledWith('y failed', 'unknown');
  });

  it('run は成功のとき ok と値を返し リクエストの headers を渡す', async () => {
    const result = await run('x', async (h) => h.get('x-test'));
    expect(result).toEqual({ ok: true, data: '1' });
  });

  it('run は失敗のとき 投げずにエラー本文を返す', async () => {
    const result = await run('x', async () => {
      throw new AppError('NOT_FOUND');
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('formFailure', () => {
  it('UNAUTHENTICATED のとき ログイン画面へ送る', () => {
    expect(() => formFailure(new AppError('UNAUTHENTICATED'), 'like')).toThrow(
      'REDIRECT /accounts/login',
    );
  });

  it('NOT_FOUND のとき 404 画面にする', () => {
    expect(() => formFailure(new AppError('NOT_FOUND'), 'like')).toThrow('NOT_FOUND_PAGE');
  });

  it('その他の AppError はそのまま投げ直す', () => {
    const error = new AppError('FORBIDDEN');
    expect(() => formFailure(error, 'like')).toThrow(error);
  });

  it('想定外のエラーは 詳細を伏せた Error に替えて投げる', () => {
    expect(() => formFailure(new TypeError('secret sql'), 'like')).toThrow(
      new Error('like failed'),
    );
  });
});
