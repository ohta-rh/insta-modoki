import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { seedNotifications } from '../../../../tests/helpers/notifications';
import { getUnreadNotificationCount } from './get-unread-notification-count';

const t = useTestDb();

describe('getUnreadNotificationCount', () => {
  it('100 件で 100、101 件でも 100 を返す', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);

    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 100 });
    expect(await getUnreadNotificationCount({}, { env, headers })).toEqual({ count: 100 });
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 1, offset: 100 });
    expect(await getUnreadNotificationCount({}, { env, headers })).toEqual({ count: 100 });
  });

  it('既読は数えず、他人宛ては数えない', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 2 });
    await seedNotifications(t.db, {
      recipientId: a.id,
      actorId: b.id,
      count: 3,
      offset: 2,
      read: true,
    });
    await seedNotifications(t.db, { recipientId: b.id, actorId: a.id, count: 4 });
    expect(await getUnreadNotificationCount({}, { env, headers })).toEqual({ count: 2 });
  });

  it('未ログインは UNAUTHENTICATED、余計な項目は VALIDATION', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const noSession = await getUnreadNotificationCount({}, { env, headers: new Headers() }).catch(
      (e) => e,
    );
    expect(noSession).toMatchObject({ code: 'UNAUTHENTICATED' });
    const headers = await sessionHeadersFor(t.db, env, a);
    const extra = await getUnreadNotificationCount({ userId: a.id }, { env, headers }).catch(
      (e) => e,
    );
    expect(extra).toBeInstanceOf(AppError);
    expect(extra).toMatchObject({ code: 'VALIDATION' });
  });
});
