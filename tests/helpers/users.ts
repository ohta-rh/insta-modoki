import { newId } from '../../src/shared/db/id';
import { users } from '../../src/shared/db/schema';
import type { Db } from '../../src/shared/db/client';

let counter = 0;

export type TestUser = { id: string; username: string; email: string; displayName: string };

/** Inserts a user row directly (no password). Unique username and email unless overridden. */
export async function createUser(db: Db, overrides: Partial<TestUser> = {}): Promise<TestUser> {
  counter += 1;
  const n = `${Date.now().toString(36)}${counter}`;
  const user: TestUser = {
    id: newId(),
    username: `user_${n}`,
    email: `user_${n}@example.com`,
    displayName: `User ${n}`,
    ...overrides,
  };
  const now = new Date();
  await db.insert(users).values({ ...user, createdAt: now, updatedAt: now });
  return user;
}
