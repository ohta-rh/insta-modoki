import { TRAY_MAX } from './limits';

export type TrayStory = {
  id: string;
  authorId: string;
  createdAt: Date;
  expiresAt: Date;
  username: string;
  displayName: string;
  avatarKey: string | null;
};

export type TrayEntry = {
  authorId: string;
  user: { username: string; displayName: string; avatarKey: string | null };
  hasUnseen: boolean;
  /** Epoch ms of the author's newest story. */
  latestAt: number;
  /** The author's stories, oldest first. */
  storyIds: string[];
};

/**
 * Groups stories by author. Authors with an unseen story come first; inside each group the one
 * with the newest story first, ties by `authorId` descending. Expired stories are left out and at
 * most `TRAY_MAX` authors are returned.
 */
export function buildTray(stories: TrayStory[], seen: Set<string>, now: number): TrayEntry[] {
  const byAuthor = new Map<string, TrayEntry>();
  const ordered = stories
    .filter((s) => s.expiresAt.getTime() > now)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const s of ordered) {
    let entry = byAuthor.get(s.authorId);
    if (!entry) {
      entry = {
        authorId: s.authorId,
        user: { username: s.username, displayName: s.displayName, avatarKey: s.avatarKey },
        hasUnseen: false,
        latestAt: 0,
        storyIds: [],
      };
      byAuthor.set(s.authorId, entry);
    }
    entry.storyIds.push(s.id);
    entry.latestAt = Math.max(entry.latestAt, s.createdAt.getTime());
    if (!seen.has(s.id)) entry.hasUnseen = true;
  }
  return [...byAuthor.values()]
    .sort(
      (a, b) =>
        Number(b.hasUnseen) - Number(a.hasUnseen) ||
        b.latestAt - a.latestAt ||
        (a.authorId < b.authorId ? 1 : a.authorId > b.authorId ? -1 : 0),
    )
    .slice(0, TRAY_MAX);
}
