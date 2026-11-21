/**
 * The text alternative of a post's photo: the author's own text when there is one, else
 * "<username> が投稿した写真（<position> / <count>）". The one place this sentence is built.
 * `position` is 1-based.
 */
export function photoAlt({
  altText,
  username,
  position,
  count,
}: {
  altText: string;
  username: string;
  position: number;
  count: number;
}): string {
  return altText.trim() !== '' ? altText : `${username} が投稿した写真（${position} / ${count}）`;
}
