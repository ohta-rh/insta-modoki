import { z } from 'zod';

/**
 * The input of savePost / unsavePost. `.strict()`: the person who saves is always the session's
 * user, so a `userId` (or any other key) is refused as VALIDATION. `postId` is not checked here:
 * a value that is no post id is NOT_FOUND (like every post read).
 */
export const saveInput = z.strictObject({ postId: z.unknown() });

/** The input of listSavedPosts: only the signed-in user's own saves, so no user is named. */
export const listSavedPostsInput = z.strictObject({ cursor: z.string().optional() });

export type SaveResult = { saved: boolean };

/** The page size of the saved grid (docs/architecture/routes.md). */
export const SAVED_PAGE_SIZE = 12;
