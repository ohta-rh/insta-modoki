import { describe, expect, it } from 'vitest';
import { isValidUsernameFormat, parseLogIn, parseSignUp, parseUsername } from './schema';

const valid = {
  email: 'Haru@Example.com',
  username: 'haru_01',
  displayName: 'Haru',
  password: 'p'.repeat(8),
};

const fieldErrors = (input: Record<string, unknown>) => {
  const r = parseSignUp({ ...valid, ...input });
  return r.ok ? null : r.fieldErrors;
};

describe('parseSignUp', () => {
  it('境界の長さを受け付け 1 つ外の長さを拒む', () => {
    for (const username of ['a'.repeat(3), 'a'.repeat(30)]) {
      expect(fieldErrors({ username }), `username ${username.length}`).toBeNull();
    }
    for (const displayName of ['あ', 'あ'.repeat(30)]) {
      expect(fieldErrors({ displayName }), `displayName ${displayName.length}`).toBeNull();
    }
    for (const password of ['x'.repeat(8), 'x'.repeat(72)]) {
      expect(fieldErrors({ password }), `password ${password.length}`).toBeNull();
    }
    const lenMsg = 'ユーザー名は 3〜30 字で入力してください';
    expect(fieldErrors({ username: 'a'.repeat(2) })?.username).toEqual([lenMsg]);
    expect(fieldErrors({ username: 'a'.repeat(31) })?.username).toEqual([lenMsg]);
    const dnMsg = '表示名は 1〜30 字で入力してください';
    expect(fieldErrors({ displayName: '' })?.displayName).toEqual([dnMsg]);
    expect(fieldErrors({ displayName: 'あ'.repeat(31) })?.displayName).toEqual([dnMsg]);
    const pwMsg = 'パスワードは 8〜72 字で入力してください';
    expect(fieldErrors({ password: 'x'.repeat(7) })?.password).toEqual([pwMsg]);
    expect(fieldErrors({ password: 'x'.repeat(73) })?.password).toEqual([pwMsg]);
  });

  it('文字数をコードポイントで数え パスワードにバイトの上限は無い', () => {
    expect(fieldErrors({ password: '😀'.repeat(72) })).toBeNull();
    expect(fieldErrors({ password: '😀'.repeat(73) })?.password).toBeDefined();
    expect(fieldErrors({ password: 'あ'.repeat(72) })).toBeNull();
    expect(fieldErrors({ displayName: '😀'.repeat(30) })).toBeNull();
  });

  it('表示名の前後の空白を除いてから数える', () => {
    const r = parseSignUp({ ...valid, displayName: '  Haru　' });
    expect(r.ok && r.data.displayName).toBe('Haru');
    expect(fieldErrors({ displayName: ' 　 ' })?.displayName).toBeDefined();
  });

  it('大文字は小文字にして受け付け . の位置と .. を拒む', () => {
    const r = parseSignUp({ ...valid, username: 'Ab1' });
    expect(r.ok && r.data.username).toBe('ab1');
    const msg = 'ユーザー名は英小文字・数字・.・_ だけ使えます（先頭と末尾は . 以外、.. は不可）';
    for (const username of ['.abc', 'abc.', 'a..b', 'ab c', 'a-b', 'ab/c', 'ab%2f', 'あいう']) {
      expect(fieldErrors({ username })?.username, username).toEqual([msg]);
    }
    expect(fieldErrors({ username: 'a.b_c' })).toBeNull();
  });

  it('予約語は大文字でも拒む', () => {
    for (const username of ['admin', 'api', 'accounts', 'ADMIN', 'Api']) {
      expect(fieldErrors({ username })?.username, username).toEqual(['このユーザー名は使えません']);
    }
  });

  it('ユーザー名とメールの NUL と制御文字を拒む', () => {
    expect(fieldErrors({ username: 'ab\u0000c' })?.username).toBeDefined();
    expect(fieldErrors({ username: 'abc\n' })?.username).toBeDefined();
    expect(fieldErrors({ email: 'a\u0000@example.com' })?.email).toBeDefined();
    expect(fieldErrors({ displayName: 'a\u0000b' })?.displayName).toBeDefined();
  });

  it('メールは小文字にし 形式が不正なら拒む', () => {
    const r = parseSignUp(valid);
    expect(r.ok && r.data.email).toBe('haru@example.com');
    for (const email of [
      '',
      'haru',
      'haru@',
      '@example.com',
      'a b@example.com',
      'x'.repeat(250) + '@e.com',
    ]) {
      expect(fieldErrors({ email })?.email, email).toEqual([
        'メールアドレスの形式を確認してください',
      ]);
    }
  });

  it('項目が文字列でないとき 項目ごとの文言を返す', () => {
    const r = parseSignUp({});
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.fieldErrors).sort()).toEqual([
        'displayName',
        'email',
        'password',
        'username',
      ]);
    expect(parseSignUp(null).ok).toBe(false);
  });
});

describe('parseUsername', () => {
  it('小文字にしてから検証する', () => {
    const r = parseUsername({ username: 'HARU' });
    expect(r.ok && r.data.username).toBe('haru');
    expect(parseUsername({ username: 'admin' }).ok).toBe(false);
    expect(parseUsername({}).ok).toBe(false);
  });
});

describe('isValidUsernameFormat', () => {
  it('保存できる形のときだけ true', () => {
    expect(isValidUsernameFormat('haru')).toBe(true);
    expect(isValidUsernameFormat('../x')).toBe(false);
    expect(isValidUsernameFormat('Haru')).toBe(false);
    expect(isValidUsernameFormat('ab')).toBe(false);
    expect(isValidUsernameFormat('admin')).toBe(false);
  });
});

describe('parseLogIn', () => {
  it('メールを小文字にし パスワードはそのまま通す', () => {
    const r = parseLogIn({ email: 'HARU@Example.com', password: ' x ' });
    expect(r).toEqual({ ok: true, data: { email: 'haru@example.com', password: ' x ' } });
  });

  it('空のメールと空のパスワードを項目ごとの文言で拒む', () => {
    const r = parseLogIn({ email: '', password: '' });
    expect(r).toEqual({
      ok: false,
      fieldErrors: {
        email: ['メールアドレスを入力してください'],
        password: ['パスワードを入力してください'],
      },
    });
  });

  it('NUL と制御文字を含むメールを拒み 文字列でない値も拒む', () => {
    for (const email of ['a\u0000@example.com', 'a\u0007@example.com']) {
      expect(parseLogIn({ email, password: 'x' }).ok, JSON.stringify(email)).toBe(false);
    }
    expect(parseLogIn({ email: 1, password: null }).ok).toBe(false);
    expect(parseLogIn(undefined).ok).toBe(false);
  });
});
