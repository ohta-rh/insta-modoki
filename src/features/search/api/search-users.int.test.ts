import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { searchUsers } from './search-users';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

// A fixed time: the rate limit uses a fixed window, so a real clock could cross its edge mid-test.
const NOW = 1_700_000_000_000;

async function signedIn(over: Parameters<typeof createUser>[1] = {}) {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db, over);
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;

const call = (s: Session, q: unknown, now = NOW) =>
  searchUsers({ q }, { env: s.env, headers: s.headers, now });
const names = async (s: Session, q: unknown) => (await call(s, q)).items.map((i) => i.username);
const rejection = async (work: () => Promise<unknown>): Promise<AppError> => {
  try {
    await work();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('expected a rejection');
};
/** A display name no query of these tests matches, so only the username decides. */
const plain = { displayName: 'Zzz' };

describe('searchUsers', () => {
  it('前方一致、部分一致、表示名の一致の順に返す', async () => {
    const me = await signedIn({ username: 'sora', ...plain });
    await createUser(t.db, { username: 'haru', displayName: 'Hana' });
    await createUser(t.db, { username: 'ohara', ...plain });
    await createUser(t.db, { username: 'mio', displayName: 'Haruka' });
    expect(await names(me, 'ha')).toEqual(['haru', 'ohara', 'mio']);

    // The caller is included when they match.
    const self = await signedIn({ username: 'hanako', ...plain });
    expect(await names(self, 'ha')).toEqual(['hanako', 'haru', 'ohara', 'mio']);
  });

  it('ワイルドカードを含む q は文字どおりに一致する', async () => {
    const me = await signedIn({ username: 'caller', ...plain });
    await createUser(t.db, { username: 'a_b', ...plain });
    await createUser(t.db, { username: 'axb', ...plain });
    await createUser(t.db, { username: 'pct', displayName: '100%' });
    await createUser(t.db, { username: 'num', displayName: '1000' });
    expect(await names(me, 'a_')).toEqual(['a_b']);
    expect(await names(me, '100%')).toEqual(['pct']);
    expect(await names(me, '\\')).toEqual([]);
  });

  it('21 人一致しても 20 人までを返し、20 人ちょうどは全員を返す', async () => {
    const me = await signedIn({ username: 'caller', ...plain });
    for (let i = 0; i < 20; i += 1) {
      await createUser(t.db, { username: `kk${String(i).padStart(2, '0')}`, ...plain });
    }
    expect(await names(me, 'kk')).toHaveLength(20);
    await createUser(t.db, { username: 'kk99', ...plain });
    const got = await names(me, 'kk');
    expect(got).toHaveLength(20);
    expect(got).toEqual([...got].sort());
    expect(got).not.toContain('kk99');
  });

  it('1 分 60 回目まで成功し、61 回目は RATE_LIMITED を返す', async () => {
    const a = await signedIn();
    const b = await signedIn();
    for (let i = 0; i < 60; i += 1) await call(a, 'x');
    const err = await rejection(() => call(a, 'x'));
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.message).toBe('操作が多すぎます。しばらくしてからもう一度お試しください');
    expect(err.retryAfterSec).toBeGreaterThanOrEqual(1);
    // Another user is not counted; the next minute starts again.
    await call(b, 'x');
    await call(a, 'x', NOW + 60_000);
    // 62 sequential D1 calls: an explicit timeout, since vitest's 5 s default is too tight on a loaded host.
  }, 60_000);

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const s = await signedIn();
    const err = await rejection(() =>
      searchUsers({ q: 'ha' }, { env: s.env, headers: new Headers(), now: NOW }),
    );
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('入力の誤りを VALIDATION で拒み fieldErrors.q に文言を載せる', async () => {
    const s = await signedIn();
    const err = await rejection(() => call(s, '  '));
    expect(err.code).toBe('VALIDATION');
    expect(err.fieldErrors).toEqual({ q: ['検索する文字を入力してください'] });
    expect(err.message).toBe('検索する文字を入力してください');
    expect((await rejection(() => call(s, 'a'.repeat(31)))).code).toBe('VALIDATION');
    expect((await rejection(() => call(s, 5))).code).toBe('VALIDATION');
  });

  it('応答の行は UserSummary の 3 項目だけで email と role を含まない', async () => {
    const me = await signedIn({ username: 'private_one', displayName: 'Secretive' });
    await t.db
      .update(users)
      .set({ isPrivate: true, avatarKey: 'avatars/x/y' })
      .where(eq(users.id, me.user.id));
    const { items } = await call(me, 'private_one');
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]!).sort()).toEqual(['avatarUrl', 'displayName', 'username']);
    expect(items[0]!.avatarUrl).toEqual(expect.stringContaining('avatars/x/y'));
    expect(JSON.stringify(items)).not.toMatch(/email|role|isPrivate|avatarKey/);
  });

  it('大文字と全角の q と、表示名の ASCII の大文字も一致する', async () => {
    const me = await signedIn({ username: 'caller', ...plain });
    await createUser(t.db, { username: 'haru', displayName: 'Hana' });
    expect(await names(me, 'HA')).toEqual(['haru']);
    expect(await names(me, '  ｈａ　')).toEqual(['haru']);
    expect(await names(me, 'hana')).toEqual(['haru']);
  });
});
