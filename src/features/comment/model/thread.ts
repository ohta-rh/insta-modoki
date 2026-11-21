import type { CommentView, Page } from './schema';

/** Who a reply in the making is for: the thread's top-level comment and the comment it answers. */
export type ReplyTarget = { rootId: string; parentId: string; username: string };

export type ThreadState = {
  /** Top-level comments, oldest first, each with the replies loaded so far. */
  items: CommentView[];
  nextCursor: string | null;
  /** Per parent: the cursor of the next replies page (null = all loaded, absent = not paged yet). */
  replyCursors: Record<string, string | null>;
  draft: string;
  replyTo: ReplyTarget | null;
  /** The message of the last failed action, for `role="alert"`. */
  error: string | null;
};

export function initThread(page: Page<CommentView>): ThreadState {
  return {
    items: page.items,
    nextCursor: page.nextCursor,
    replyCursors: {},
    draft: '',
    replyTo: null,
    error: null,
  };
}

const byAge = (a: CommentView, b: CommentView) =>
  a.createdAt < b.createdAt
    ? -1
    : a.createdAt > b.createdAt
      ? 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0;

/** `incoming` wins over an `existing` row with the same id; the result is oldest first. */
function mergeById(existing: CommentView[], incoming: CommentView[]): CommentView[] {
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) byId.set(c.id, c);
  return [...byId.values()].sort(byAge);
}

const mapParent = (
  items: CommentView[],
  id: string,
  change: (parent: CommentView) => CommentView,
): CommentView[] => items.map((c) => (c.id === id ? change(c) : c));

/** The comment goes to the end at once: of the list, or of its thread (the count follows). */
export function startSubmit(
  state: ThreadState,
  temp: CommentView,
  rootId: string | null,
): ThreadState {
  const base = { ...state, draft: '', replyTo: null, error: null };
  if (rootId === null) return { ...base, items: [...state.items, temp] };
  return {
    ...base,
    items: mapParent(state.items, rootId, (p) => ({
      ...p,
      replies: [...(p.replies ?? []), temp],
      replyCount: (p.replyCount ?? p.replies?.length ?? 0) + 1,
    })),
  };
}

/** The server's row takes the temporary row's place (or only removes it if already present). */
export function finishSubmit(
  state: ThreadState,
  tempId: string,
  saved: CommentView,
  rootId: string | null,
): ThreadState {
  const swap = (list: CommentView[]): CommentView[] => {
    const present = list.some((c) => c.id === saved.id);
    return present
      ? list.filter((c) => c.id !== tempId)
      : list.map((c) => (c.id === tempId ? saved : c));
  };
  if (rootId === null) return { ...state, items: swap(state.items) };
  return {
    ...state,
    items: mapParent(state.items, rootId, (p) => ({ ...p, replies: swap(p.replies ?? []) })),
  };
}

/**
 * The request failed: the temporary row goes away, the text and the reply target come back (unless
 * the user has already started something new) and the message is shown.
 */
export function failSubmit(
  state: ThreadState,
  tempId: string,
  rootId: string | null,
  restore: { draft: string; replyTo: ReplyTarget | null },
  message: string,
): ThreadState {
  const base = {
    ...state,
    draft: state.draft === '' ? restore.draft : state.draft,
    replyTo: state.replyTo ?? restore.replyTo,
    error: message,
  };
  if (rootId === null) return { ...base, items: state.items.filter((c) => c.id !== tempId) };
  return {
    ...base,
    items: mapParent(state.items, rootId, (p) => ({
      ...p,
      replies: (p.replies ?? []).filter((c) => c.id !== tempId),
      replyCount: Math.max(0, (p.replyCount ?? 0) - 1),
    })),
  };
}

/** The next page of top-level comments, without repeating a row the list already has. */
export function appendParents(state: ThreadState, page: Page<CommentView>): ThreadState {
  return { ...state, items: mergeById(state.items, page.items), nextCursor: page.nextCursor };
}

/** The next page of one parent's replies, without repeating the ones already shown. */
export function appendReplies(
  state: ThreadState,
  parentId: string,
  page: Page<CommentView>,
): ThreadState {
  return {
    ...state,
    items: mapParent(state.items, parentId, (p) => ({
      ...p,
      replies: mergeById(p.replies ?? [], page.items),
    })),
    replyCursors: { ...state.replyCursors, [parentId]: page.nextCursor },
  };
}

/** How many replies of `comment` are not on screen yet. */
export const remainingReplies = (comment: CommentView): number =>
  Math.max(0, (comment.replyCount ?? 0) - (comment.replies?.length ?? 0));

export function hasMoreReplies(state: ThreadState, comment: CommentView): boolean {
  const cursor = state.replyCursors[comment.id];
  if (cursor === null) return false;
  return typeof cursor === 'string' || remainingReplies(comment) > 0;
}

/** Removes a comment (a parent takes its replies with it); `removed` is how many rows went. */
export function removeComment(
  state: ThreadState,
  id: string,
): { state: ThreadState; removed: number } {
  const parent = state.items.find((c) => c.id === id);
  if (parent) {
    const { [id]: _gone, ...replyCursors } = state.replyCursors;
    return {
      state: { ...state, items: state.items.filter((c) => c.id !== id), replyCursors },
      removed: 1 + (parent.replyCount ?? parent.replies?.length ?? 0),
    };
  }
  const owner = state.items.find((c) => c.replies?.some((r) => r.id === id));
  if (!owner) return { state, removed: 0 };
  return {
    state: {
      ...state,
      items: mapParent(state.items, owner.id, (p) => ({
        ...p,
        replies: (p.replies ?? []).filter((r) => r.id !== id),
        replyCount: Math.max(0, (p.replyCount ?? 0) - 1),
      })),
    },
    removed: 1,
  };
}
