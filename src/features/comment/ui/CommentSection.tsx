'use client';

import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
  listRepliesAction,
} from '../api/actions';
import type { CommentView, Page } from '../model/schema';
import {
  appendParents,
  appendReplies,
  failSubmit,
  finishSubmit,
  hasMoreReplies,
  initThread,
  remainingReplies,
  removeComment,
  startSubmit,
  type ThreadState,
} from '../model/thread';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { useCommentCount } from './CommentCount';
import { DeleteCommentDialog } from './DeleteCommentDialog';

const NETWORK_MESSAGE = INTERNAL_MESSAGE;
const more =
  'min-h-[var(--tap-min)] rounded-lg px-3 text-[length:var(--font-size-sm)] font-bold text-text-secondary hover:bg-surface hover:text-text disabled:opacity-50';

type Viewer = { username: string } | null;
type Reply<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

/** An action that fails by network (the promise rejects) answers like a server error. */
async function call<T>(work: () => Promise<Reply<T>>): Promise<Reply<T>> {
  try {
    return await work();
  } catch {
    return { ok: false, error: { message: NETWORK_MESSAGE } };
  }
}

/**
 * The comments of a post: the list (oldest first, replies indented one level), "さらに読み込む",
 * the fixed comment box and the delete confirmation. A comment appears at the end of the list at
 * once and is replaced by the server's row; if the request fails it goes away and the text comes
 * back (model/thread.ts holds the state changes).
 */
export function CommentSection({
  postId,
  viewer,
  initial,
  requestId,
}: {
  postId: string;
  /** The signed-in user, or null for a visitor (who can read but not write). */
  viewer: Viewer;
  initial: Page<CommentView>;
  /** The id the no-script path of the form sends as `clientRequestId`. */
  requestId: string;
}) {
  const [state, setState] = useState<ThreadState>(() => initThread(initial));
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<CommentView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const counter = useCommentCount();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  // One id per (text, target) so a retry after a lost answer cannot add the comment twice.
  const attempt = useRef<{ id: string; body: string; parentId: string | null } | null>(null);

  useEffect(() => {
    setReady(true);
    setNow(Date.now());
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = state.draft.trim();
    if (body === '' || viewer === null) return;
    const { replyTo, draft } = state;
    const rootId = replyTo?.rootId ?? null;
    const parentId = replyTo?.parentId ?? null;
    const same = attempt.current?.body === body && attempt.current.parentId === parentId;
    const id = same ? attempt.current!.id : crypto.randomUUID();
    attempt.current = { id, body, parentId };

    const tempId = `tmp-${crypto.randomUUID()}`;
    const temp: CommentView = {
      id: tempId,
      author: { username: viewer.username, displayName: viewer.username, avatarUrl: null },
      body,
      parentId: rootId,
      createdAt: new Date().toISOString(),
      canDelete: true,
      ...(rootId === null ? { replies: [], replyCount: 0 } : {}),
    };
    setState((s) => startSubmit(s, temp, rootId));
    counter.add(1);

    const result = await call(() =>
      addCommentAction({
        postId,
        body,
        ...(parentId === null ? {} : { parentId }),
        clientRequestId: id,
      }),
    );
    if (result.ok) {
      attempt.current = null;
      setState((s) => finishSubmit(s, tempId, result.data, rootId));
    } else {
      counter.add(-1);
      setState((s) => failSubmit(s, tempId, rootId, { draft, replyTo }, result.error.message));
    }
  };

  const loadMore = async () => {
    setBusy('comments');
    const result = await call(() => listCommentsAction({ postId, cursor: state.nextCursor }));
    if (result.ok) setState((s) => ({ ...appendParents(s, result.data), error: null }));
    else setState((s) => ({ ...s, error: result.error.message }));
    setBusy(null);
  };

  const loadReplies = async (parent: CommentView) => {
    setBusy(parent.id);
    const cursor = state.replyCursors[parent.id];
    const result = await call(() =>
      listRepliesAction({ commentId: parent.id, ...(cursor ? { cursor } : {}) }),
    );
    if (result.ok) setState((s) => ({ ...appendReplies(s, parent.id, result.data), error: null }));
    else setState((s) => ({ ...s, error: result.error.message }));
    setBusy(null);
  };

  const startReply = (comment: CommentView) => {
    setState((s) => ({
      ...s,
      replyTo: {
        rootId: comment.parentId ?? comment.id,
        parentId: comment.id,
        username: comment.author.username,
      },
    }));
    inputRef.current?.focus();
  };

  const askDelete = (comment: CommentView, button: HTMLButtonElement) => {
    trigger.current = button;
    setTarget(comment);
    setDeleteError(null);
    dialogRef.current?.showModal();
  };

  const confirmDelete = async () => {
    if (!target || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await call(() => deleteCommentAction({ commentId: target.id }));
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    const removal = removeComment(state, target.id);
    setState(removal.state);
    counter.add(-removal.removed);
    dialogRef.current?.close();
  };

  return (
    <section aria-label="コメント">
      {state.items.length === 0 && (
        <p className="px-3 py-6 text-center text-[length:var(--font-size-sm)] text-text-secondary">
          まだコメントはありません
        </p>
      )}
      <ul aria-live="polite" aria-relevant="additions removals" className="px-3">
        {state.items.flatMap((comment) => [
          <CommentItem
            key={comment.id}
            comment={comment}
            isReply={false}
            now={now}
            canReply={viewer !== null}
            onReply={startReply}
            onDelete={askDelete}
          />,
          ...(comment.replies ?? []).map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              now={now}
              canReply={viewer !== null}
              onReply={startReply}
              onDelete={askDelete}
            />
          )),
          ...(hasMoreReplies(state, comment)
            ? [
                <li key={`${comment.id}-more`} className="ml-11">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => loadReplies(comment)}
                    className={more}
                  >
                    {`返信 ${remainingReplies(comment)} 件を見る`}
                  </button>
                </li>,
              ]
            : []),
        ])}
      </ul>
      {state.nextCursor !== null && (
        <div className="flex justify-center px-3 py-2">
          <button type="button" disabled={busy !== null} onClick={loadMore} className={more}>
            コメントをさらに読み込む
          </button>
        </div>
      )}
      {viewer ? (
        <CommentForm
          postId={postId}
          requestId={requestId}
          draft={state.draft}
          replyTo={state.replyTo}
          error={state.error}
          ready={ready}
          inputRef={inputRef}
          onDraftChange={(draft) => setState((s) => ({ ...s, draft }))}
          onSubmit={submit}
          onCancelReply={() => setState((s) => ({ ...s, replyTo: null }))}
        />
      ) : (
        <p className="border-t border-border py-4 text-center text-[length:var(--font-size-sm)]">
          <a href="/accounts/login" className="font-bold text-link">
            ログイン
          </a>
          してコメントする
        </p>
      )}
      <DeleteCommentDialog
        dialogRef={dialogRef}
        pending={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => trigger.current?.focus()}
      />
    </section>
  );
}
