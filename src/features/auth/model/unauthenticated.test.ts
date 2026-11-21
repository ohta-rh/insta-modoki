import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors';
import { isUnauthenticated } from './unauthenticated';

describe('isUnauthenticated', () => {
  it('UNAUTHENTICATED の AppError だけを true にする', () => {
    expect(isUnauthenticated(new AppError('UNAUTHENTICATED'))).toBe(true);
    expect(isUnauthenticated(new AppError('FORBIDDEN'))).toBe(false);
    expect(isUnauthenticated(new AppError('RATE_LIMITED'))).toBe(false);
    expect(isUnauthenticated(new Error('db down'))).toBe(false);
    expect(isUnauthenticated(null)).toBe(false);
  });
});
