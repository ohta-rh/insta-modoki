// The like slice's entry for its screens and client components (ADR-0057). Only the routes and
// other slices' components import it; `../index.ts` stays free of `'use client'` modules.
export { DoubleTapLike } from './DoubleTapLike';
export { LikeButton } from './LikeButton';
export { LikeScope } from './LikeScope';
export { LikersDialog } from './LikersDialog';
