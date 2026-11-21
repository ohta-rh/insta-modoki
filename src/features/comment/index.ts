// The comment slice's public entry: other slices and the routes import only from here.
export { addComment } from './api/add-comment';
export { deleteComment } from './api/delete-comment';
export { listComments } from './api/list-comments';
export { listReplies } from './api/list-replies';
export type { CommentView, Page } from './model/schema';
export { CommentCountLink, CommentCountProvider } from './ui/CommentCount';
export { CommentSection } from './ui/CommentSection';
