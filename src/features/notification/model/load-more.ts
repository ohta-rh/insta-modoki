import { INTERNAL_MESSAGE } from '../../../shared/errors';
import type { ActionResult } from '../../../shared/action';
import type { NotificationPage, NotificationView } from './schema';

export type ListState = {
  items: NotificationView[];
  nextCursor: string | null;
  /** The message of the last failed load, shown as an alert; null when it worked. */
  error: string | null;
};

export const initList = (page: NotificationPage): ListState => ({
  items: page.items,
  nextCursor: page.nextCursor,
  error: null,
});

/**
 * Loads the page after `state.nextCursor` and appends it. A failure (a result with `ok: false`, or
 * a thrown error) keeps the rows and the cursor, so the button stays, and sets `error`.
 */
export async function loadMore(
  state: ListState,
  fetchPage: (cursor: string) => Promise<ActionResult<NotificationPage>>,
): Promise<ListState> {
  if (state.nextCursor === null) return state;
  try {
    const result = await fetchPage(state.nextCursor);
    if (!result.ok) return { ...state, error: result.error.message };
    return {
      items: [...state.items, ...result.data.items],
      nextCursor: result.data.nextCursor,
      error: null,
    };
  } catch {
    return { ...state, error: INTERNAL_MESSAGE };
  }
}
