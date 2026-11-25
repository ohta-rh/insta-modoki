import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin, insertInvite } from '../../../../tests/helpers/invites';
import { testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { invites, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { AuthEnv } from './auth-env';
import { signUp } from './sign-up';

const t = useTestDb();
const required = () => ({ ...testAuthEnv(t.d1), INVITE_REQUIRED: 'true' });
let n = 0;
const input = (over: Record<string, unknown> = {}) => {
  n += 1;
  return {
    email: `invitee${n}@example.com`,
    username: `invitee_${n}`,
    displayName: 'Invitee',
    password: crypto.randomUUID(),
    ...over,
  };
};
const deps = (env: AuthEnv = required()) => ({ env, headers: new Headers() });

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}
const used = async (code: string) =>
  (await t.db.select().from(invites).where(eq(invites.code, code)))[0]!.usedCount;
const userCount = async () => (await t.db.select().from(users)).length;

describe('signUp', () => {
  it('有効なコードで登録でき used_count が 1 になる', async () => {
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id, { maxUses: 1 });
    const before = await userCount();
    const result = await signUp(input({ inviteCode: invite.code }), deps());
    expect(result.username).toMatch(/^invitee_/);
    expect(await used(invite.code)).toBe(1);
    expect(await userCount()).toBe(before + 1);
  });

  it('小文字と前後の空白つきでも通る', async () => {
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id, { maxUses: 2 });
    await signUp(input({ inviteCode: `  ${invite.code.toLowerCase()}\t` }), deps());
    expect(await used(invite.code)).toBe(1);
  });

  it('不明・失効・期限切れ・使い切り・未入力のコードを、それぞれの文言で拒む', async () => {
    const admin = await createAdmin(t.db);
    const revoked = await insertInvite(t.db, admin.id, { revokedAt: new Date() });
    const expired = await insertInvite(t.db, admin.id, { expiresAt: new Date(Date.now() - 1) });
    const usedUp = await insertInvite(t.db, admin.id, { maxUses: 1, usedCount: 1 });
    const cases: [unknown, string][] = [
      ['ZZZZZZZZZZ', '招待コードが正しくありません'],
      ['abc', '招待コードが正しくありません'],
      [revoked.code, 'この招待コードは無効になりました'],
      [expired.code, 'この招待コードは期限が切れています'],
      [usedUp.code, 'この招待コードは使用回数の上限に達しました'],
      [undefined, '招待コードを入力してください'],
      ['   ', '招待コードを入力してください'],
    ];
    const before = await userCount();
    for (const [inviteCode, message] of cases) {
      const e = await rejection(() => signUp(input({ inviteCode }), deps()));
      expect(e.code, String(inviteCode)).toBe('VALIDATION');
      expect(e.fieldErrors, String(inviteCode)).toEqual({ inviteCode: [message] });
    }
    expect(await userCount()).toBe(before);
    expect(await used(revoked.code)).toBe(0);
  });

  it('maxUses が 1 のコードを 2 人が同時に使うと 1 人だけ成功する', async () => {
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id, { maxUses: 1 });
    const results = await Promise.allSettled([
      signUp(input({ inviteCode: invite.code }), deps()),
      signUp(input({ inviteCode: invite.code }), deps()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(AppError);
    expect(failed.reason.code).toBe('VALIDATION');
    expect(failed.reason.fieldErrors).toEqual({
      inviteCode: ['この招待コードは使用回数の上限に達しました'],
    });
    expect(await used(invite.code)).toBe(1);
    expect(
      (await t.db.select().from(users)).filter((u) => u.username.startsWith('invitee_')),
    ).toHaveLength(1);
  });

  it('ユーザー名が重複したときコードを消費しない', async () => {
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id, { maxUses: 1 });
    await createUser(t.db, { username: 'taken_name' });
    const e = await rejection(() =>
      signUp(input({ username: 'taken_name', inviteCode: invite.code }), deps()),
    );
    expect(e.code).toBe('CONFLICT');
    expect(await used(invite.code)).toBe(0);
  });

  it('同時に同じユーザー名で登録して batch が落ちてもコードを消費しない', async () => {
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id, { maxUses: 2 });
    const same = input({ inviteCode: invite.code });
    const results = await Promise.allSettled([
      signUp(same, deps()),
      signUp({ ...same, email: 'other@example.com' }, deps()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await used(invite.code)).toBe(1);
  });

  it('INVITE_REQUIRED が true でないときコード無しで登録できる', async () => {
    const env = testAuthEnv(t.d1);
    const result = await signUp(input(), deps(env));
    expect(result.username).toMatch(/^invitee_/);
    const withValue = { ...testAuthEnv(t.d1), INVITE_REQUIRED: 'false' };
    await signUp(input(), deps(withValue));
  });

  it('INVITE_REQUIRED が true でなくてもコードが付いていれば同じ検証をする', async () => {
    const env = testAuthEnv(t.d1);
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id, { revokedAt: new Date() });
    const e = await rejection(() => signUp(input({ inviteCode: invite.code }), deps(env)));
    expect(e.fieldErrors).toEqual({ inviteCode: ['この招待コードは無効になりました'] });
    const ok = await insertInvite(t.db, admin.id, { maxUses: 1 });
    await signUp(input({ inviteCode: ok.code }), deps(env));
    expect(await used(ok.code)).toBe(1);
  });
});
