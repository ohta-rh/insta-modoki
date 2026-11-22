export type ProfileTab = 'posts' | 'saved';

/**
 * The tab a profile opens on, from `?tab=`. "saved" is private to its owner, so it is chosen only
 * for the owner's own profile and exactly `saved`; anything else (another value, a repeated key,
 * someone else's profile) is the posts tab.
 */
export function profileTab(isMe: boolean, raw: string | string[] | undefined): ProfileTab {
  return isMe && raw === 'saved' ? 'saved' : 'posts';
}
