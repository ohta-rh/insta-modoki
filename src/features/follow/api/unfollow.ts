import { setFollow, type FollowDeps } from './set-follow';

/** Stops following a user. Unfollowing someone not followed changes nothing and returns the same result. */
export const unfollow = (input: unknown, deps: FollowDeps) => setFollow(input, deps, false);
