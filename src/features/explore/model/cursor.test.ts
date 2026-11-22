import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors';
import { decodeExploreCursor, encodeExploreCursor } from './cursor';

const NOW = Date.UTC(2026, 10, 22, 12);
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64url');
const ISO = '2026-11-20T00:00:00.000Z';

function invalid(value: string, now = NOW): AppError {
  try {
    decodeExploreCursor(value, now);
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}

describe('exploreCursor', () => {
  it('asOf・いいね数・時刻・id を往復し、壊れた値を VALIDATION にする', () => {
    const cursor = {
      asOf: NOW,
      likeCount: 7,
      createdAt: new Date(Date.UTC(2026, 10, 20, 1, 2, 3, 456)),
      id: '0199-abc',
    };
    const text = encodeExploreCursor(cursor);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(text, 'base64url').toString('utf8')).toBe(
      `${NOW}|7|2026-11-20T01:02:03.456Z|0199-abc`,
    );
    expect(decodeExploreCursor(text, NOW)).toEqual(cursor);
    // asOf equal to now is allowed; zero likes are allowed.
    expect(decodeExploreCursor(b64(`${NOW}|0|${ISO}|x`), NOW).likeCount).toBe(0);

    const broken = [
      '%%%',
      '',
      b64(`${NOW}|1|${ISO}`),
      b64(`${NOW}|1|${ISO}|a|b`),
      b64(`x|1|${ISO}|a`),
      b64(`1.5|1|${ISO}|a`),
      b64(`${NOW}|x|${ISO}|a`),
      b64(`${NOW}|1.5|${ISO}|a`),
      b64(`${NOW}|-1|${ISO}|a`),
      b64(`-1|1|${ISO}|a`),
      b64(`${NOW}|1|2026-11-20|a`),
      b64(`${NOW}|1|2026-13-40T00:00:00.000Z|a`),
      b64(`${NOW}|1|${ISO}|`),
      b64(`${NOW + 1}|1|${ISO}|a`),
      b64(`9007199254740993|1|${ISO}|a`),
    ];
    for (const value of broken) {
      const err = invalid(value);
      expect(err.code, value).toBe('VALIDATION');
      expect(err.message).toBe('入力を確認してください');
    }
  });
});
