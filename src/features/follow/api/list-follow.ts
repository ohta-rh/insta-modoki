import { and, desc, eq } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { follows, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import type { UserSummary } from '../../post';
import { lookupUsername } from '../../profile';
import { FOLLOW_PAGE_SIZE, listFollowInput } from '../model/schema';

export type ListFollowDeps = { env?: AuthEnv & StorageEnv };
export type FollowPage = { items: UserSummary[]; nextCursor: string | null };

/**
 * One page of a person's followers (`direction` "followers": the rows whose followee they are, the
 * listed people are the followers) or of the people they follow ("following"), newest follow first
 * (ties: larger id of the listed person first), 20 a page. Anyone may read it, so no login is
 * needed. The cursor carries the last row's follow time and the listed person's user id
 * (docs/architecture/conventions.md "カーソル"); a broken one is VALIDATION.
 */
export async function listFollow(
  input: unknown,
  deps: ListFollowDeps,
  direction: 'followers' | 'following',
): Promise<FollowPage> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const parsed = listFollowInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const after = readCursor(parsed.data.cursor);
  const username = lookupUsername(parsed.data.username);
  if (username === null) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  // `owner` is the person whose list this is; `listed` is the column of the people in it.
  const owner = direction === 'followers' ? follows.followeeId : follows.followerId;
  const listed = direction === 'followers' ? follows.followerId : follows.followeeId;
  const [ownerRows] = await db.batch([
    db.select({ id: users.id }).from(users).where(eq(users.username, username)),
  ]);
  const ownerRow = ownerRows[0];
  if (!ownerRow) throw new AppError('NOT_FOUND');

  const rows = await db
    .select({
      createdAt: follows.createdAt,
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, listed))
    .where(and(eq(owner, ownerRow.id), keysetBefore(follows.createdAt, listed, after)))
    .orderBy(desc(follows.createdAt), desc(listed))
    .limit(FOLLOW_PAGE_SIZE + 1);

  const page = toPage(rows, FOLLOW_PAGE_SIZE);
  return {
    items: page.items.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      avatarUrl: avatarUrl(env, r.avatarKey),
    })),
    nextCursor: page.nextCursor,
  };
}
