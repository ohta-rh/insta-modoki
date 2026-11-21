import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { checkUsername } from './check-username';

const t = useTestDb();

describe('checkUsername', () => {
  it('大文字小文字が違うだけの username のとき available が false になる', async () => {
    await createUser(t.db, { username: 'haru' });
    expect(await checkUsername({ username: 'HaRu' }, { env: { DB: t.d1 as never } })).toEqual({
      available: false,
    });
  });

  it('使われていない username のとき available が true になる', async () => {
    expect(await checkUsername({ username: 'mio' }, { env: { DB: t.d1 as never } })).toEqual({
      available: true,
    });
  });

  it('形式が不正または予約語のとき VALIDATION を返す', async () => {
    for (const username of ['.abc', 'ab', 'admin']) {
      const err = await checkUsername({ username }, { env: { DB: t.d1 as never } }).catch((e) => e);
      expect(err, username).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VALIDATION');
      expect((err as AppError).fieldErrors?.username).toHaveLength(1);
    }
  });
});
