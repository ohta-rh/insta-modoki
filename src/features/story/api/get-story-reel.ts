import { eq, inArray, sql } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import type { UserSummary } from '../../post';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { avatarUrl, mediaSrcset, publicUrl, type StorageEnv } from '../../../shared/storage';
import { findActiveStories, findSeenStoryIds } from '../db/queries';
import { storyViews } from '../db/schema';
import { readReelUsername, storyReelInput } from '../model/schema';
import { buildTray } from '../model/tray';

export type StoryItemView = {
  id: string;
  type: 'image' | 'video';
  width: number;
  height: number;
  altText: string;
  srcset: { w320: string; w640: string; w1080: string } | null;
  videoUrl: string | null;
  durationMs: number | null;
  /** ISO 8601, UTC. */
  createdAt: string;
  expiresAt: string;
  /** Only the author sees how many people viewed; null for anyone else. */
  viewerCount: number | null;
};
export type StoryReel = {
  user: UserSummary;
  isMe: boolean;
  stories: StoryItemView[];
  startIndex: number;
  nextUsername: string | null;
};
export type GetStoryReelDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * One person's unexpired stories, oldest first, for the viewer: where to start (the first one the
 * viewer has not seen; 0 when all are seen or they are their own), and who comes next: the first person after
 * this one in the viewer's tray order who still has an unseen story. A person who does not exist or has nothing unexpired is NOT_FOUND. No
 * session is UNAUTHENTICATED. The storage key never leaves; only the URLs built from it do.
 */
export async function getStoryReel(input: unknown, deps: GetStoryReelDeps): Promise<StoryReel> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const me = await requireUser(deps.headers, { env });
  const parsed = storyReelInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const name = readReelUsername(parsed.data.username);
  if (name === null) throw new AppError('NOT_FOUND');
  const now = deps.now ?? Date.now();
  const db = getDb(env);

  const author = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
    })
    .from(users)
    .where(eq(users.username, name))
    .get();
  if (!author) throw new AppError('NOT_FOUND');
  const isMe = author.id === me.id;

  const [rows, seen, followed] = await Promise.all([
    findActiveStories(db, { authors: { ids: [author.id] }, now }),
    findSeenStoryIds(db, { viewerId: me.id, now }),
    findActiveStories(db, { authors: { followedBy: me.id }, now }),
  ]);
  if (rows.length === 0) throw new AppError('NOT_FOUND');

  const counts = new Map<string, number>();
  if (isMe) {
    const grouped = await db
      .select({ storyId: storyViews.storyId, n: sql<number>`count(*)` })
      .from(storyViews)
      .where(
        inArray(
          storyViews.storyId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(storyViews.storyId);
    for (const g of grouped) counts.set(g.storyId, Number(g.n));
  }

  const firstUnseen = rows.findIndex((r) => !seen.has(r.id));
  const tray = buildTray(
    followed.filter((s) => s.authorId !== me.id),
    seen,
    now,
  );
  const at = tray.findIndex((e) => e.user.username === author.username);
  // After this person, the first one who still has something unseen; their own reel goes to the
  // tray's first. A person who is not in the tray has no next.
  const after = isMe ? tray : at >= 0 ? tray.slice(at + 1) : [];
  const nextUsername = after.find((e) => e.hasUnseen)?.user.username ?? null;

  return {
    user: {
      username: author.username,
      displayName: author.displayName,
      avatarUrl: avatarUrl(env, author.avatarKey),
    },
    isMe,
    stories: rows.map((r) => ({
      id: r.id,
      type: r.type,
      width: r.width,
      height: r.height,
      altText: r.altText,
      srcset: r.type === 'image' ? mediaSrcset(env, r.storageKey) : null,
      videoUrl: r.type === 'video' ? publicUrl(env, `${r.storageKey}/video.mp4`) : null,
      durationMs: r.durationMs,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      viewerCount: isMe ? (counts.get(r.id) ?? 0) : null,
    })),
    startIndex: isMe || firstUnseen < 0 ? 0 : firstUnseen,
    nextUsername,
  };
}
