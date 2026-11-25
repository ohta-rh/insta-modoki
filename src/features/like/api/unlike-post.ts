import { setLike, type LikeDeps } from './set-like';

/** Removes the signed-in user's like. Without a like it changes nothing; the count never goes below 0. */
export const unlikePost = (input: unknown, deps: LikeDeps) => setLike(input, deps, false);
