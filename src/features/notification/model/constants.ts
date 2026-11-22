// Plain values with no imports: the client code (badge text, the unread store) reads them, and
// importing schema.ts there would put zod into the browser bundle (its `Function('')` probe then
// breaks the CSP on every screen).

/** The page size of the notification list (docs/architecture/routes.md). */
export const NOTIFICATIONS_PAGE_SIZE = 20;
/** The unread count stops here: it reads at most this many rows, and the badge shows "99+". */
export const UNREAD_COUNT_CAP = 100;
/** A comment is shown in a notification up to this many characters. */
export const COMMENT_PREVIEW_LENGTH = 100;
