import { listFollow, type ListFollowDeps } from './list-follow';

export type { FollowPage, ListFollowDeps } from './list-follow';

/** The people who follow a user, newest follow first, 20 a page. */
export const listFollowers = (input: unknown, deps: ListFollowDeps = {}) =>
  listFollow(input, deps, 'followers');
