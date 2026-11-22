import { setSaved, type SaveDeps } from './set-saved';

/** Removes the signed-in user's save. Without a save it changes nothing. */
export const unsavePost = (input: unknown, deps: SaveDeps) => setSaved(input, deps, false);
