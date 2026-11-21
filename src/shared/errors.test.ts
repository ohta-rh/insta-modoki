import { describe, expect, it } from 'vitest';
import { AppError, httpStatusOf, toErrorResponse } from './errors';

describe('AppError', () => {
  it('code だけ渡すと既定の文言になる', () => {
    const e = new AppError('VALIDATION');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('VALIDATION');
    expect(e.message).toBe('入力を確認してください');
  });

  it('文言と fieldErrors と retryAfterSec を持てる', () => {
    const e = new AppError('RATE_LIMITED', {
      message: '多すぎます',
      fieldErrors: { body: ['入力してください'] },
      retryAfterSec: 30,
    });
    expect(e.message).toBe('多すぎます');
    expect(e.fieldErrors).toEqual({ body: ['入力してください'] });
    expect(e.retryAfterSec).toBe(30);
  });
});

describe('httpStatusOf', () => {
  it('code ごとに conventions.md の HTTP 状態を返す', () => {
    expect(httpStatusOf('UNAUTHENTICATED')).toBe(401);
    expect(httpStatusOf('FORBIDDEN')).toBe(403);
    expect(httpStatusOf('NOT_FOUND')).toBe(404);
    expect(httpStatusOf('VALIDATION')).toBe(422);
    expect(httpStatusOf('CONFLICT')).toBe(409);
    expect(httpStatusOf('RATE_LIMITED')).toBe(429);
    expect(httpStatusOf('PAYLOAD_TOO_LARGE')).toBe(413);
  });
});

describe('toErrorResponse', () => {
  it('AppError のとき code と message と fieldErrors と retryAfterSec をそのまま返す', () => {
    const res = toErrorResponse(
      new AppError('RATE_LIMITED', { retryAfterSec: 12, fieldErrors: { a: ['x'] } }),
    );
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      code: 'RATE_LIMITED',
      message: '操作が多すぎます。しばらくしてからもう一度お試しください',
      fieldErrors: { a: ['x'] },
      retryAfterSec: 12,
    });
  });

  it('内部の例外のとき 固定の文言の 500 にして 例外の内容を含めない', () => {
    const res = toErrorResponse(new Error('SQLITE_ERROR: no such table users at /app/db.ts:1'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      code: 'INTERNAL',
      message: 'エラーが発生しました。しばらくしてからもう一度お試しください',
    });
    expect(JSON.stringify(res)).not.toContain('SQLITE');
    expect(JSON.stringify(res)).not.toContain('/app/db.ts');
  });

  it('Error でない値が投げられたときも 固定の文言の 500 にする', () => {
    expect(toErrorResponse('boom').status).toBe(500);
  });
});
