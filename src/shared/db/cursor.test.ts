import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { decodeCursor, encodeCursor } from './cursor';

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

describe('cursor', () => {
  it('エンコードしてデコードすると元に戻る', () => {
    const cursor = {
      createdAt: new Date('2026-11-21T01:02:03.456Z'),
      id: '019a0000-0000-7000-8000-000000000000',
    };
    const s = encodeCursor(cursor);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(s, 'base64url').toString('utf8')).toBe(
      '2026-11-21T01:02:03.456Z|019a0000-0000-7000-8000-000000000000',
    );
    expect(decodeCursor(s)).toEqual(cursor);
  });

  it.each([
    ['base64url でない文字列', '!!!***'],
    ['| が無い', b64url('2026-11-21T01:02:03.456Z')],
    ['日時でない', b64url('not-a-date|abc')],
    ['空文字列', ''],
  ])('壊れたカーソル（%s）は VALIDATION を返す', (_name, input) => {
    let thrown: unknown;
    try {
      decodeCursor(input);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).code).toBe('VALIDATION');
    expect((thrown as AppError).message).toBe('入力を確認してください');
  });
});
