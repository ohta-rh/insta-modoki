import { setLike, type LikeDeps } from './set-like';

/** Likes a post as the signed-in user. Liking again changes nothing and returns the same result. */
export const likePost = (input: unknown, deps: LikeDeps) => setLike(input, deps, true);
