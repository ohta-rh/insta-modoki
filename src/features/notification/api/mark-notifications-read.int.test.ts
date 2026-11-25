import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { seedNotifications } from '../../../../tests/helpers/notifications';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { notifications } from '../../../shared/db/schema';
import { getUnreadNotificationCount } from './get-unread-notification-count';
import { markNotificationsRead } from './mark-notifications-read';

const t = useTestDb();

describe('markNotificationsRead', () => {
  it('未読を数え、既読にして、0 に戻る', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 3 });

    expect(await getUnreadNotificationCount({}, { env, headers })).toEqual({ count: 3 });
    expect(await markNotificationsRead({}, { env, headers, now: 1_700_000_000_000 })).toEqual({
      readCount: 3,
    });
    expect(await getUnreadNotificationCount({}, { env, headers })).toEqual({ count: 0 });
    expect(await markNotificationsRead({}, { env, headers })).toEqual({ readCount: 0 });
    const rows = await t.db.select().from(notifications);
    expect(rows.every((r) => r.readAt?.getTime() === 1_700_000_000_000)).toBe(true);
  });

  it('自分宛ての未読だけを既読にし、他人の未読は変えない', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const c = await createUser(t.db);
    await seedNotifications(t.db, { recipientId: a.id, actorId: c.id, count: 2 });
    await seedNotifications(t.db, { recipientId: c.id, actorId: a.id, count: 2 });
    const headers = await sessionHeadersFor(t.db, env, a);

    expect(await markNotificationsRead({}, { env, headers })).toEqual({ readCount: 2 });
    const theirs = await t.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, c.id));
    expect(theirs).toHaveLength(2);
    expect(theirs.every((r) => r.readAt === null)).toBe(true);

    const error = await markNotificationsRead({ userId: c.id }, { env, headers }).catch((e) => e);
    expect(error).toMatchObject({ code: 'VALIDATION' });
    const noSession = await markNotificationsRead({}, { env, headers: new Headers() }).catch(
      (e) => e,
    );
    expect(noSession).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
