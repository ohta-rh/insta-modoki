// The notification slice's public entry. Other slices import only the five statement
// functions (ADR-0014); the routes and the shell import the screen and the badge.
export {
  deleteFollowNotification,
  deleteLikeNotification,
  insertCommentNotification,
  insertFollowNotification,
  insertLikeNotification,
} from './db/statements';
