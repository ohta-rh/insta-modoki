// The notification slice's public entry for other slices: only the five statement functions
// (ADR-0014). It must stay free of components: the like, comment and follow APIs import it, and
// a component here would drag a server-only screen into the client bundle of every screen that
// shows a post. The routes and the root layout import the screen and the badge from './ui'.
export {
  deleteFollowNotification,
  deleteLikeNotification,
  insertCommentNotification,
  insertFollowNotification,
  insertLikeNotification,
} from './db/statements';
