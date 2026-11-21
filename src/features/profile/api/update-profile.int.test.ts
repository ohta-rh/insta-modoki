import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost as createTestPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv, putObject, putPhoto } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { newId } from '../../../shared/db/id';
import { storageOrphans, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { updateProfile } from './update-profile';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const RESELECT = '画像を選び直してください';
const NOW = 1_700_000_000_000;
const files = (key: string) => ['orig', 'w320', 'w640', 'w1080'].map((n) => `${key}/${n}.webp`);

async function signedIn() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db, { displayName: '元の名前' });
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;
const call = (s: Session, input: unknown, extra: Record<string, unknown> = {}) =>
  updateProfile(input, { env: s.env, headers: s.headers, now: NOW, ...extra });

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}
const rowOf = async (id: string) => (await t.db.select().from(users).where(eq(users.id, id)))[0]!;

async function uploaded(userId: string): Promise<string> {
  const key = `media/${userId}/${newId()}`;
  await putPhoto(storage, key);
  return key;
}

describe('updateProfile', () => {
  it('セッションの利用者の行だけを変え 他人の行は変えない', async () => {
    const s = await signedIn();
    const other = await createUser(t.db, { displayName: '他人の名前' });

    const view = await call(s, { displayName: '  新しい名前 ', bio: '一行目\n二行目' });

    expect(view).toMatchObject({
      username: s.user.username,
      displayName: '新しい名前',
      bio: '一行目\n二行目',
      isMe: true,
    });
    const mine = await rowOf(s.user.id);
    expect(mine.displayName).toBe('新しい名前');
    expect(mine.updatedAt.getTime()).toBe(NOW);
    expect((await rowOf(other.id)).displayName).toBe('他人の名前');
    expect((await rowOf(other.id)).bio).toBe('');
  });

  it('未ログインのとき UNAUTHENTICATED を返す', async () => {
    const s = await signedIn();
    const error = await rejection(() =>
      updateProfile({ displayName: 'x', bio: '' }, { env: s.env, headers: new Headers() }),
    );
    expect(error.code).toBe('UNAUTHENTICATED');
    expect((await rowOf(s.user.id)).displayName).toBe('元の名前');
  });

  it('151 字の自己紹介のとき VALIDATION を返し 行を変えない', async () => {
    const s = await signedIn();
    const error = await rejection(() => call(s, { displayName: '変える', bio: 'あ'.repeat(151) }));
    expect(error.code).toBe('VALIDATION');
    expect(error.message).toBe('自己紹介は 150 字までです');
    expect(error.fieldErrors).toEqual({ bio: ['自己紹介は 150 字までです'] });
    const row = await rowOf(s.user.id);
    expect(row.displayName).toBe('元の名前');
    expect(row.bio).toBe('');
    // 150 is the edge that still saves.
    await call(s, { displayName: '変える', bio: 'あ'.repeat(150) });
    expect((await rowOf(s.user.id)).bio).toHaveLength(150);
  });

  it('他人の領域の avatarKey を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const other = await createUser(t.db);
    const foreign = await uploaded(other.id);
    const error = await rejection(() => call(s, { displayName: 'x', bio: '', avatarKey: foreign }));
    expect(error.code).toBe('VALIDATION');
    expect(error.message).toBe(RESELECT);
    expect((await rowOf(s.user.id)).avatarKey).toBeNull();
    // Files of the other user stay.
    for (const f of files(foreign)) expect(await headObject(storage, f), f).not.toBeNull();
    // A key of the wrong shape in the user's own area is refused too.
    const bad = await rejection(() =>
      call(s, { displayName: 'x', bio: '', avatarKey: `media/${s.user.id}/../${other.id}/x` }),
    );
    expect(bad.message).toBe(RESELECT);
  });

  it('ストレージに無い avatarKey を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const missing = `media/${s.user.id}/${newId()}`;
    const error = await rejection(() =>
      call(s, { displayName: '変える', bio: '', avatarKey: missing }),
    );
    expect(error.code).toBe('VALIDATION');
    expect(error.message).toBe(RESELECT);
    const row = await rowOf(s.user.id);
    expect(row.avatarKey).toBeNull();
    expect(row.displayName).toBe('元の名前');
  });

  it('WebP でないファイルの avatarKey は VALIDATION で拒み そのファイルを消す', async () => {
    const s = await signedIn();
    const key = `media/${s.user.id}/${newId()}`;
    for (const f of files(key)) await putObject(storage, f, new Uint8Array([1, 2, 3]), 'image/png');
    const error = await rejection(() => call(s, { displayName: 'x', bio: '', avatarKey: key }));
    expect(error.message).toBe(RESELECT);
    for (const f of files(key)) expect(await headObject(storage, f), f).toBeNull();
  });

  it('投稿の写真に使われている key を avatarKey にできない', async () => {
    const s = await signedIn();
    const post = await createTestPost(t.db, s.user.id);
    const key = post.media[0]!.storageKey;
    await putPhoto(storage, key);
    const error = await rejection(() => call(s, { displayName: 'x', bio: '', avatarKey: key }));
    expect(error.message).toBe(RESELECT);
    for (const f of files(key)) expect(await headObject(storage, f), f).not.toBeNull();
  });

  it('avatarKey を送ると アイコンが変わり avatarUrl が w320 を指す', async () => {
    const s = await signedIn();
    const key = await uploaded(s.user.id);
    const view = await call(s, { displayName: '名前', bio: '', avatarKey: key });
    expect((await rowOf(s.user.id)).avatarKey).toBe(key);
    expect(view.avatarUrl).toMatch(new RegExp(`${key}/w320\\.webp$`));
  });

  it('アイコンを入れ替えると 古いファイルを消す', async () => {
    const s = await signedIn();
    const oldKey = await uploaded(s.user.id);
    await call(s, { displayName: '名前', bio: '', avatarKey: oldKey });
    const newKey = await uploaded(s.user.id);

    await call(s, { displayName: '名前', bio: '', avatarKey: newKey });

    expect((await rowOf(s.user.id)).avatarKey).toBe(newKey);
    for (const f of files(oldKey)) expect(await headObject(storage, f), f).toBeNull();
    for (const f of files(newKey)) expect(await headObject(storage, f), f).not.toBeNull();
  });

  it('古いファイルを消せないとき storage_orphans に記録し 保存は成功する', async () => {
    const s = await signedIn();
    const oldKey = await uploaded(s.user.id);
    await call(s, { displayName: '名前', bio: '', avatarKey: oldKey });
    const newKey = await uploaded(s.user.id);
    const failing = vi.fn(async (_client: unknown, keys: string[]) => keys);

    const view = await call(
      s,
      { displayName: '名前', bio: '', avatarKey: newKey },
      { removeObjects: failing },
    );

    expect(view.avatarUrl).toContain(newKey);
    expect((await rowOf(s.user.id)).avatarKey).toBe(newKey);
    const orphans = await t.db.select().from(storageOrphans);
    expect(orphans.map((o) => o.storageKey).sort()).toEqual(files(oldKey).sort());
  });

  it('avatarKey を送らないとき アイコンを変えない', async () => {
    const s = await signedIn();
    const key = await uploaded(s.user.id);
    await call(s, { displayName: '名前', bio: '', avatarKey: key });

    await call(s, { displayName: '別の名前', bio: '自己紹介' });

    const row = await rowOf(s.user.id);
    expect(row.avatarKey).toBe(key);
    expect(row.displayName).toBe('別の名前');
    for (const f of files(key)) expect(await headObject(storage, f), f).not.toBeNull();
  });

  it('同じ内容を 2 回保存しても同じ ProfileView を返す', async () => {
    const s = await signedIn();
    const key = await uploaded(s.user.id);
    const input = { displayName: '名前', bio: '自己紹介', avatarKey: key };

    const first = await call(s, input);
    const second = await call(s, input);

    expect(second).toEqual(first);
    // The same key again is not "an old icon": its files stay.
    for (const f of files(key)) expect(await headObject(storage, f), f).not.toBeNull();
  });
});
