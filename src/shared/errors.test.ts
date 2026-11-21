import { describe, expect, it } from 'vitest';
import { AppError } from './errors';

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
