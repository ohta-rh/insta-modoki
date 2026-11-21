import { setFollow, type FollowDeps } from './set-follow';

/** Follows a user as the signed-in user. Following again changes nothing and returns the same result. */
export const follow = (input: unknown, deps: FollowDeps) => setFollow(input, deps, true);
