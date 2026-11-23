// The like slice's entry for its components, client and server (ADR-0057). `../index.ts` publishes
// only processing and types, so importing a process never loads a component.
export { DoubleTapLike } from './DoubleTapLike';
export { LikeButton } from './LikeButton';
export { LikeScope } from './LikeScope';
export { LikersDialog } from './LikersDialog';
