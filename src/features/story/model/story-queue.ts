const KEY = 'storyQueue';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** The default store; `sessionStorage` may be missing (server) or refuse access (private mode). */
function defaultStore(): Store | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Remembers, for this tab, the order in which the viewer walks through the authors. */
export function saveStoryQueue(usernames: string[], storage: Store | null = defaultStore()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(usernames));
  } catch {
    // Saving is a convenience; without it the viewer simply stops at the end of one author.
  }
}

/**
 * The saved order decides, for a person who is in it: the author after `current`, or `next: null`
 * at the end (the viewer closes). Without a saved order, a person outside it, or an unreadable
 * value it is `inQueue: false` and the server's next person is used.
 */
export function nextFromQueue(
  current: string,
  storage: Store | null = defaultStore(),
): { inQueue: true; next: string | null } | { inQueue: false } {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { inQueue: false };
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list) || !list.every((v) => typeof v === 'string')) {
      return { inQueue: false };
    }
    const at = list.indexOf(current);
    return at >= 0 ? { inQueue: true, next: list[at + 1] ?? null } : { inQueue: false };
  } catch {
    return { inQueue: false };
  }
}
