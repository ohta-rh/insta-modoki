'use client';

import { useId, useRef, useState } from 'react';
import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { adminDeleteUserAction, listAdminUsersAction } from '../api/actions';
import type { AdminUserRow } from '../model/schema';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { useDeleteFlow } from './useDeleteFlow';

const BUTTON =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';
const CELL = 'px-3 py-2 align-top text-left';

const formatDate = (d: Date) =>
  new Date(d).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
const labelOf = (r: AdminUserRow) => `@${r.username}`;

type Props = { initialItems: AdminUserRow[]; initialCursor: string | null };

/** The administrator's user list: filter by user-name prefix, 20 at a time, delete behind a confirmation. */
export function AdminUserTable({ initialItems, initialCursor }: Props) {
  const { snapshot, controller } = useDeleteFlow<AdminUserRow>({
    rows: initialItems,
    keyOf: (r) => r.username,
    labelOf,
    remove: (username) => adminDeleteUserAction({ username }),
    fallbackMessage: INTERNAL_MESSAGE,
  });
  const [cursor, setCursor] = useState(initialCursor);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const target = snapshot.rows.find((r) => r.username === snapshot.target);

  const load = async (nextQuery: string, from: string | null) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setListError(null);
    try {
      const result = await listAdminUsersAction({
        ...(nextQuery === '' ? {} : { query: nextQuery }),
        ...(from === null ? {} : { cursor: from }),
      });
      if (result.ok) {
        controller.setRows((rows) =>
          from === null ? result.data.items : [...rows, ...result.data.items],
        );
        setCursor(result.data.nextCursor);
        setActiveQuery(nextQuery);
      } else setListError(result.error.message);
    } catch {
      setListError(INTERNAL_MESSAGE);
    }
    inFlight.current = false;
    setLoading(false);
  };

  return (
    <div ref={panel} tabIndex={-1} className="outline-none">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(query.trim(), null);
        }}
        className="mb-3 flex items-end gap-2"
      >
        <div className="flex-1">
          <label
            htmlFor={searchId}
            className="mb-1 block text-[length:var(--font-size-sm)] font-bold"
          >
            ユーザー名で絞る
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            maxLength={30}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[var(--tap-min)] w-full rounded-lg border border-border bg-bg px-3 text-[length:var(--font-size-md)] text-text"
          />
        </div>
        <button type="submit" className={`${BUTTON} border border-border hover:bg-surface`}>
          絞り込む
        </button>
      </form>
      {snapshot.error ? (
        <p role="alert" className="mb-2 text-[length:var(--font-size-sm)] text-danger">
          {snapshot.error}
        </p>
      ) : null}
      {listError ? (
        <p role="alert" className="mb-2 text-[length:var(--font-size-sm)] text-danger">
          {listError}
        </p>
      ) : null}
      <p role="status" className="mb-2 text-[length:var(--font-size-sm)] text-text-secondary">
        {snapshot.notice}
      </p>
      {snapshot.rows.length === 0 ? (
        <p className="text-[length:var(--font-size-sm)] text-text-secondary">
          {activeQuery === '' ? '利用者はいません' : '該当する利用者はいません'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[length:var(--font-size-sm)]">
            <caption className="sr-only">利用者の一覧（新しい順）</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={CELL}>
                  ユーザー名
                </th>
                <th scope="col" className={CELL}>
                  表示名
                </th>
                <th scope="col" className={CELL}>
                  投稿数
                </th>
                <th scope="col" className={CELL}>
                  登録日時
                </th>
                <th scope="col" className={CELL}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((r) => (
                <tr key={r.username} className="border-b border-border">
                  <td className={CELL}>
                    <a href={`/${r.username}`} className="font-bold underline">
                      @{r.username}
                    </a>
                  </td>
                  <td className={`${CELL} break-all`}>{r.displayName}</td>
                  <td className={CELL}>{r.postCount}</td>
                  <td className={CELL}>{formatDate(r.createdAt)}</td>
                  <td className={CELL}>
                    {r.role === 'admin' ? (
                      <span className="text-text-secondary">管理者</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => controller.ask(r.username)}
                        aria-label={`${labelOf(r)} を削除`}
                        className={`${BUTTON} text-danger hover:bg-wash`}
                      >
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor !== null ? (
        <button
          type="button"
          onClick={() => void load(activeQuery, cursor)}
          aria-disabled={loading || undefined}
          className={`${BUTTON} mt-3 border border-border hover:bg-surface aria-disabled:opacity-50`}
        >
          さらに表示
        </button>
      ) : null}
      <AdminConfirmDialog
        open={snapshot.target !== null}
        title={target ? labelOf(target) : ''}
        message="この利用者を削除します。投稿・コメント・いいね・画像も全て消え、元に戻せません"
        busy={snapshot.busy}
        onConfirm={() => void controller.confirm()}
        onCancel={controller.cancel}
        fallbackFocus={panel}
      />
    </div>
  );
}
