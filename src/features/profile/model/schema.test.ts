import { describe, expect, it } from 'vitest';
import { BIO_MESSAGE, DISPLAY_NAME_MESSAGE, parseUpdateProfile } from './schema';

const parse = (over: Record<string, unknown> = {}) =>
  parseUpdateProfile({ displayName: '名前', bio: '', ...over });

describe('parseUpdateProfile', () => {
  it('自己紹介の 150 字を受け付け 151 字を拒む', () => {
    expect(parse({ bio: 'あ'.repeat(150) }).ok).toBe(true);
    // Code points, not UTF-16 units: 150 emoji are 300 units.
    expect(parse({ bio: '😀'.repeat(150) }).ok).toBe(true);
    const over = parse({ bio: 'あ'.repeat(151) });
    expect(over).toEqual({ ok: false, fieldErrors: { bio: [BIO_MESSAGE] } });
    expect(BIO_MESSAGE).toBe('自己紹介は 150 字までです');
    expect(parse({ bio: '😀'.repeat(151) }).ok).toBe(false);
  });

  it('表示名の 1 字と 30 字を受け付け 空白だけと 31 字を拒む', () => {
    expect(parse({ displayName: 'あ' }).ok).toBe(true);
    expect(parse({ displayName: 'あ'.repeat(30) }).ok).toBe(true);
    for (const bad of ['', '   ', '　\t\n', 'あ'.repeat(31)]) {
      expect(parse({ displayName: bad })).toEqual({
        ok: false,
        fieldErrors: { displayName: [DISPLAY_NAME_MESSAGE] },
      });
    }
    expect(DISPLAY_NAME_MESSAGE).toBe('表示名は 1〜30 字で入力してください');
  });

  it('表示名は前後の空白を除いて数え 除いた値を返す', () => {
    const r = parse({ displayName: `  ${'あ'.repeat(30)} ` });
    expect(r).toEqual({ ok: true, data: { displayName: 'あ'.repeat(30), bio: '' } });
  });

  it('制御文字と NUL を拒む（改行は自己紹介で使える）', () => {
    expect(parse({ displayName: 'a\0b' }).ok).toBe(false);
    expect(parse({ displayName: 'a\nb' }).ok).toBe(false);
    expect(parse({ bio: 'a\0b' }).ok).toBe(false);
    expect(parse({ bio: '一行目\n二行目' }).ok).toBe(true);
  });

  it('avatarKey は省略できる 送るときは文字列', () => {
    expect(parse().ok && (parse() as { data: object }).data).not.toHaveProperty('avatarKey');
    expect(parse({ avatarKey: 'media/u/k' })).toMatchObject({
      ok: true,
      data: { avatarKey: 'media/u/k' },
    });
    expect(parse({ avatarKey: 5 }).ok).toBe(false);
    expect(parse({ avatarKey: '' }).ok).toBe(false);
  });

  it('文字列でない入力を拒む', () => {
    expect(parseUpdateProfile(null).ok).toBe(false);
    expect(parseUpdateProfile({ displayName: 1, bio: 2 }).ok).toBe(false);
    expect(parseUpdateProfile({ displayName: '名前' }).ok).toBe(false);
  });
});
