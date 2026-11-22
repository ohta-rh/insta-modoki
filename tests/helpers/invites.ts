import { eq } from 'drizzle-orm';
import type { Db } from '../../src/shared/db/client';
import { invites, users } from '../../src/shared/db/schema';
import { createUser, type TestUser } from './users';

/** A user whose `users.role` is 'admin'. */
export async function createAdmin(db: Db, overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const user = await createUser(db, overrides);
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
  return user;
}

let counter = 0;

export type InviteRow = typeof invites.$inferInsert;

/** Inserts an invite row directly: unique code, 5 uses, valid for a day, unless overridden. */
export async function insertInvite(
  db: Db,
  createdBy: string,
  overrides: Partial<InviteRow> = {},
): Promise<typeof invites.$inferSelect> {
  counter += 1;
  const code = `T${String(counter).padStart(4, '0')}${Date.now().toString(36).toUpperCase()}`
    .slice(0, 10)
    .padEnd(10, 'X');
  const now = Date.now();
  const row: InviteRow = {
    code,
    createdBy,
    maxUses: 5,
    usedCount: 0,
    expiresAt: new Date(now + 86_400_000),
    revokedAt: null,
    createdAt: new Date(now),
    ...overrides,
  };
  await db.insert(invites).values(row);
  return (await db.select().from(invites).where(eq(invites.code, row.code)))[0]!;
}
