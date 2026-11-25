import type { UserSummary } from '../../post';
import { SEARCH_FAILED_MESSAGE } from './limits';

export type SearchResponse =
  { ok: true; data: { items: UserSummary[] } } | { ok: false; error: { message: string } };
export type SearchSnapshot = {
  /** What the box holds. */
  text: string;
  /** The text the shown `items` answer, or null before any answer. */
  answered: string | null;
  items: UserSummary[];
  error: string | null;
};
export type SearchController = {
  input(text: string): void;
  snapshot(): SearchSnapshot;
  dispose(): void;
};

export const SEARCH_DELAY_MS = 250;

/**
 * The state behind the search box: an input restarts a 250 ms timer, and when it fires one call
 * is made for the latest text. A Server Action cannot be aborted, so each call carries a number
 * and an answer that is not for the latest number is dropped. Any new input makes an
 * answer still in flight stale; blank text calls nothing.
 */
export function createSearchController(opts: {
  search: (q: string) => Promise<SearchResponse>;
  onChange: (s: SearchSnapshot) => void;
  delayMs?: number;
}): SearchController {
  let state: SearchSnapshot = { text: '', answered: null, items: [], error: null };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest = 0;

  const set = (next: SearchSnapshot) => {
    state = next;
    opts.onChange(state);
  };
  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  async function call(q: string) {
    const mine = latest;
    let response: SearchResponse;
    try {
      response = await opts.search(q);
    } catch {
      response = { ok: false, error: { message: SEARCH_FAILED_MESSAGE } };
    }
    if (mine !== latest) return;
    if (response.ok) set({ ...state, answered: q, items: response.data.items, error: null });
    else set({ ...state, error: response.error.message });
  }

  return {
    input(text) {
      stopTimer();
      latest += 1; // an answer to an older text is stale from now on
      const q = text.trim();
      if (q === '') {
        set({ text, answered: null, items: [], error: null });
        return;
      }
      set({ ...state, text });
      timer = setTimeout(() => {
        timer = null;
        void call(q);
      }, opts.delayMs ?? SEARCH_DELAY_MS);
    },
    snapshot: () => state,
    dispose() {
      stopTimer();
      latest += 1;
    },
  };
}
