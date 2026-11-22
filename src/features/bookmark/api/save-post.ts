import { setSaved, type SaveDeps } from './set-saved';

/** Saves a post for the signed-in user. Saving again changes nothing and returns the same result. */
export const savePost = (input: unknown, deps: SaveDeps) => setSaved(input, deps, true);
