import { listFollow, type ListFollowDeps } from './list-follow';

/** The people a user follows, newest follow first, 20 a page. */
export const listFollowing = (input: unknown, deps: ListFollowDeps = {}) =>
  listFollow(input, deps, 'following');
