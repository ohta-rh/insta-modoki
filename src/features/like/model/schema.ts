import { z } from 'zod';

/**
 * The input of likePost / unlikePost. `.strict()`: the person who likes is always the session's
 * user, so a `userId` (or any other key) in the input is refused as VALIDATION. `postId` is not
 * checked here: a value that is no post id is NOT_FOUND (like every post read).
 */
export const likeInput = z.strictObject({ postId: z.unknown() });

export const listLikersInput = z.strictObject({
  postId: z.unknown(),
  cursor: z.string().optional(),
});

export type LikeResult = { liked: boolean; likeCount: number };

/** The page size of the likers list (docs/architecture/routes.md). */
export const LIKERS_PAGE_SIZE = 20;
