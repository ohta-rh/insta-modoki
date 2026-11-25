import { describe, expect, it } from 'vitest';
import { newId } from '../../src/shared/db';
import { users } from '../../src/shared/db/schema';
import { useTestDb } from './db';

describe('useTestDb', () => {
  const t = useTestDb();

  it('1 つ目のテストで入れた行は 2 つ目から見えない（入れる側）', async () => {
    await t.db.insert(users).values({
      id: newId(),
      username: 'alice',
      displayName: 'Alice',
      email: 'a@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await t.db.select().from(users)).toHaveLength(1);
  });

  it('1 つ目のテストで入れた行は 2 つ目から見えない', async () => {
    expect(await t.db.select().from(users)).toHaveLength(0);
  });
});
