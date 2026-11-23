import type { ActionResult } from '../../../shared/action';

export type DeleteSnapshot<R> = {
  rows: R[];
  /** The key waiting for the confirmation, or null. */
  target: string | null;
  busy: boolean;
  /** The server's message of the last failed delete, shown in role="alert". */
  error: string | null;
  /** Said politely after a delete ("削除しました"). */
  notice: string;
};

export type DeleteController<R> = {
  snapshot(): DeleteSnapshot<R>;
  ask(key: string): void;
  cancel(): void;
  confirm(): Promise<void>;
  /** Replaces the rows (after "さらに表示"). */
  setRows(update: (rows: R[]) => R[]): void;
};

type Options<R> = {
  rows: R[];
  keyOf: (row: R) => string;
  /** Calls the Server Action; it may reject (the network failing). */
  remove: (key: string) => Promise<ActionResult<{ deleted: true }>>;
  labelOf: (row: R) => string;
  fallbackMessage: string;
  onChange: (snapshot: DeleteSnapshot<R>) => void;
};

/**
 * The state of one table's delete flow: ask (the confirmation opens), cancel, confirm. A failed
 * delete keeps the row and keeps the server's message; a second confirm while one is running is
 * dropped. Written without React so it can be tested without a DOM.
 */
export function createDeleteController<R>(options: Options<R>): DeleteController<R> {
  let state: DeleteSnapshot<R> = {
    rows: options.rows,
    target: null,
    busy: false,
    error: null,
    notice: '',
  };
  const set = (patch: Partial<DeleteSnapshot<R>>) => {
    state = { ...state, ...patch };
    options.onChange(state);
  };

  return {
    snapshot: () => state,
    ask: (key) => set({ target: key, error: null, notice: '' }),
    cancel: () => {
      if (!state.busy) set({ target: null });
    },
    confirm: async () => {
      const key = state.target;
      if (state.busy || key === null) return;
      const row = state.rows.find((r) => options.keyOf(r) === key);
      set({ busy: true });
      try {
        const result = await options.remove(key);
        if (result.ok) {
          set({
            rows: state.rows.filter((r) => options.keyOf(r) !== key),
            target: null,
            busy: false,
            notice: row ? `${options.labelOf(row)} を削除しました` : '削除しました',
          });
        } else {
          set({ target: null, busy: false, error: result.error.message });
        }
      } catch {
        set({ target: null, busy: false, error: options.fallbackMessage });
      }
    },
    setRows: (update) => set({ rows: update(state.rows) }),
  };
}
