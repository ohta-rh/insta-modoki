import { describe, expect, it } from 'vitest';
import { addCommentInput, EMPTY_MESSAGE, TOO_LONG_MESSAGE } from './schema';

const ids = {
  postId: '0198a0f0-0000-7000-8000-000000000001',
  clientRequestId: '0198a0f0-0000-7000-8000-000000000002',
};
const parse = (body: unknown, extra: object = {}) =>
  addCommentInput.safeParse({ ...ids, body, ...extra });
const bodyErrors = (r: ReturnType<typeof parse>) =>
  r.success ? [] : r.error.issues.filter((i) => i.path[0] === 'body').map((i) => i.message);

describe('addCommentInput', () => {
  it('2,200 字は通り 2,201 字は「コメントは 2,200 字までです」で拒む', () => {
    const ok = parse('あ'.repeat(2200));
    expect(ok.success).toBe(true);
    const over = parse('あ'.repeat(2201));
    expect(bodyErrors(over)).toEqual(['コメントは 2,200 字までです']);
    expect(TOO_LONG_MESSAGE).toBe('コメントは 2,200 字までです');
    // The limit counts code points: 2,200 emoji pass although they are 4,400 UTF-16 units.
    expect(parse('😀'.repeat(2200)).success).toBe(true);
    expect(bodyErrors(parse('😀'.repeat(2201)))).toEqual([TOO_LONG_MESSAGE]);
  });

  it('前後の空白を除いて 1 字なら通り 保存する値は空白を除いたものになる', () => {
    const r = parse('  \n あ 　 ');
    expect(r.success && r.data.body).toBe('あ');
    // Spaces around a 2,200-character body are not counted.
    expect(parse(` ${'あ'.repeat(2200)} `).success).toBe(true);
  });

  it('空白だけは「コメントを入力してください」で拒む', () => {
    for (const body of ['', '   ', '\n\t　']) {
      expect(bodyErrors(parse(body)), JSON.stringify(body)).toEqual([EMPTY_MESSAGE]);
    }
    expect(EMPTY_MESSAGE).toBe('コメントを入力してください');
  });

  it('文字列でない本文と NUL を含む本文を拒む', () => {
    expect(parse(123).success).toBe(false);
    expect(parse('a\0b').success).toBe(false);
  });

  it('postId・clientRequestId・parentId が UUID でないとき 拒み 余計な項目も拒む', () => {
    expect(parse('a', { postId: 'x' }).success).toBe(false);
    expect(parse('a', { clientRequestId: 'x' }).success).toBe(false);
    expect(parse('a', { parentId: 'x' }).success).toBe(false);
    expect(parse('a', { parentId: ids.postId }).success).toBe(true);
    expect(parse('a', { admin: true }).success).toBe(false);
  });
});
