import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import {
  decodeCursor,
  encodeCursor,
  keysetAfter,
  keysetBefore,
  readCursor,
  toPage,
} from './cursor';
import { posts } from './schema';

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

describe('readCursor', () => {
  it('無い（undefined / null）とき null を返す', () => {
    expect(readCursor(undefined)).toBeNull();
    expect(readCursor(null)).toBeNull();
  });

  it('文字列でないとき VALIDATION を返す', () => {
    expect(() => readCursor(5)).toThrow(AppError);
  });

  it('文字列のとき デコードして返す', () => {
    const cursor = { createdAt: new Date('2026-11-21T01:02:03.456Z'), id: 'a' };
    expect(readCursor(encodeCursor(cursor))).toEqual(cursor);
  });
});

describe('keysetAfter / keysetBefore', () => {
  const cursor = { createdAt: new Date('2026-11-21T01:02:03.456Z'), id: 'a' };

  it('カーソルが無いとき 条件を足さない', () => {
    expect(keysetAfter(posts.createdAt, posts.id, null)).toBeUndefined();
    expect(keysetBefore(posts.createdAt, posts.id, null)).toBeUndefined();
  });

  it('カーソルがあるとき 条件を返す', () => {
    expect(keysetAfter(posts.createdAt, posts.id, cursor)).toBeDefined();
    expect(keysetBefore(posts.createdAt, posts.id, cursor)).toBeDefined();
  });
});

describe('toPage', () => {
  const at = (n: number) => new Date(Date.UTC(2026, 10, 21, 0, 0, n));
  const rows = [1, 2, 3].map((n) => ({ id: `id${n}`, createdAt: at(n) }));

  it('size + 1 行あるとき 先頭 size 行と 最後の行のカーソルを返す', () => {
    const page = toPage(rows, 2);
    expect(page.items).toEqual(rows.slice(0, 2));
    expect(decodeCursor(page.nextCursor!)).toEqual({ createdAt: at(2), id: 'id2' });
  });

  it('size 行以下のとき 次のページは無い', () => {
    expect(toPage(rows.slice(0, 2), 2)).toEqual({ items: rows.slice(0, 2), nextCursor: null });
    expect(toPage([], 2)).toEqual({ items: [], nextCursor: null });
  });

  it('カーソルの id を行から選べる', () => {
    const page = toPage(
      [
        { userId: 'u1', createdAt: at(1) },
        { userId: 'u2', createdAt: at(2) },
      ],
      1,
      (r) => ({ createdAt: r.createdAt, id: r.userId }),
    );
    expect(decodeCursor(page.nextCursor!).id).toBe('u1');
  });
});
