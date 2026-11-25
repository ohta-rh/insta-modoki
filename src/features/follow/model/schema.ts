import { z } from 'zod';

/**
 * The input of follow / unfollow. `.strict()`: the person who follows is always the session's
 * user, so a `followerId` (or any other key) in the input is refused as VALIDATION. `username` is
 * not checked here: a name that can never be a user is NOT_FOUND (like every profile read).
 */
export const followInput = z.strictObject({ username: z.unknown() });

export const listFollowInput = z.strictObject({
  username: z.unknown(),
  cursor: z.string().optional(),
});

export type FollowResult = { following: boolean; followerCount: number };

/** The page size of the follower / following lists (docs/architecture/routes.md). */
export const FOLLOW_PAGE_SIZE = 20;

export const SELF_FOLLOW_MESSAGE = '自分自身はフォローできません';
