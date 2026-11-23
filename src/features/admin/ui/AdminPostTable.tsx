'use client';

import { useRef, useState } from 'react';
import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { adminDeletePostAction, listAdminPostsAction } from '../api/actions';
import type { AdminPostRow } from '../model/schema';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { useDeleteFlow } from './useDeleteFlow';

const BUTTON =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';
const CELL = 'px-3 py-2 align-top text-left';

const formatDate = (d: Date) =>
  new Date(d).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
const labelOf = (r: AdminPostRow) => `@${r.authorUsername} の投稿`;

type Props = { initialItems: AdminPostRow[]; initialCursor: string | null };

/** The administrator's post list (20 at a time, newest first) with a delete behind a confirmation. */
export function AdminPostTable({ initialItems, initialCursor }: Props) {
  const { snapshot, controller } = useDeleteFlow<AdminPostRow>({
    rows: initialItems,
    keyOf: (r) => r.id,
    labelOf,
    remove: (id) => adminDeletePostAction({ postId: id }),
    fallbackMessage: INTERNAL_MESSAGE,
  });
  const [cursor, setCursor] = useState(initialCursor);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const target = snapshot.rows.find((r) => r.id === snapshot.target);

  const more = async () => {
    if (inFlight.current || cursor === null) return;
    inFlight.current = true;
    setLoading(true);
    setMoreError(null);
    try {
      const result = await listAdminPostsAction({ cursor });
      if (result.ok) {
        controller.setRows((rows) => [...rows, ...result.data.items]);
        setCursor(result.data.nextCursor);
      } else setMoreError(result.error.message);
    } catch {
      setMoreError(INTERNAL_MESSAGE);
    }
    inFlight.current = false;
    setLoading(false);
  };

  return (
    <div ref={panel} tabIndex={-1} className="outline-none">
      {snapshot.error ? (
        <p role="alert" className="mb-2 text-[length:var(--font-size-sm)] text-red-700">
          {snapshot.error}
        </p>
      ) : null}
      <p role="status" className="mb-2 text-[length:var(--font-size-sm)] text-text-secondary">
        {snapshot.notice}
      </p>
      {snapshot.rows.length === 0 ? (
        <p className="text-[length:var(--font-size-sm)] text-text-secondary">投稿はありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[length:var(--font-size-sm)]">
            <caption className="sr-only">投稿の一覧（新しい順）</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={CELL}>
                  投稿者
                </th>
                <th scope="col" className={CELL}>
                  キャプション
                </th>
                <th scope="col" className={CELL}>
                  投稿日時
                </th>
                <th scope="col" className={CELL}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className={CELL}>
                    <a href={`/p/${r.id}`} className="font-bold underline">
                      @{r.authorUsername}
                    </a>
                  </td>
                  <td className={`${CELL} break-all`}>{r.captionExcerpt}</td>
                  <td className={CELL}>{formatDate(r.createdAt)}</td>
                  <td className={CELL}>
                    <button
                      type="button"
                      onClick={() => controller.ask(r.id)}
                      aria-label={`${labelOf(r)} を削除`}
                      className={`${BUTTON} text-red-700 hover:bg-surface`}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moreError ? (
        <p role="alert" className="mt-2 text-[length:var(--font-size-sm)] text-red-700">
          {moreError}
        </p>
      ) : null}
      {cursor !== null ? (
        <button
          type="button"
          onClick={more}
          aria-disabled={loading || undefined}
          className={`${BUTTON} mt-3 border border-border hover:bg-surface aria-disabled:opacity-50`}
        >
          さらに表示
        </button>
      ) : null}
      <AdminConfirmDialog
        open={snapshot.target !== null}
        title={target ? labelOf(target) : ''}
        message="この投稿を削除します。元に戻せません"
        busy={snapshot.busy}
        onConfirm={() => void controller.confirm()}
        onCancel={controller.cancel}
        fallbackFocus={panel}
      />
    </div>
  );
}
