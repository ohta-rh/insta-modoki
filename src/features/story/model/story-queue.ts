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

/** The author after `current` in the saved order, or null (last, unknown, nothing saved, unreadable). */
export function nextInQueue(
  current: string,
  storage: Store | null = defaultStore(),
): string | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list) || !list.every((v) => typeof v === 'string')) return null;
    const at = list.indexOf(current);
    return at >= 0 ? (list[at + 1] ?? null) : null;
  } catch {
    return null;
  }
}
