// The like slice's public entry: other slices and the routes import only from here.
export { likePost } from './api/like-post';
export { unlikePost } from './api/unlike-post';
export { listLikers, type LikersPage } from './api/list-likers';
export { likeInput, listLikersInput, type LikeResult } from './model/schema';
export { DoubleTapLike } from './ui/DoubleTapLike';
export { LikeButton } from './ui/LikeButton';
export { LikeScope } from './ui/LikeScope';
export { LikersDialog } from './ui/LikersDialog';
