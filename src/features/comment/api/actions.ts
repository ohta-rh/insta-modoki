'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { run, logUnexpected, type ActionResult } from '../../../shared/action';
import { AppError } from '../../../shared/errors';
import { isId, type CommentView, type Page } from '../model/schema';
import { addComment } from './add-comment';
import { deleteComment } from './delete-comment';
import { listComments } from './list-comments';
import { listReplies } from './list-replies';

export async function addCommentAction(input: unknown): Promise<ActionResult<CommentView>> {
  return run('addComment', (h) => addComment(input, { headers: h }));
}

export async function deleteCommentAction(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  return run('deleteComment', (h) => deleteComment(input, { headers: h }));
}

export async function listCommentsAction(input: unknown): Promise<ActionResult<Page<CommentView>>> {
  return run('listComments', (h) => listComments(input, { headers: h }));
}

export async function listRepliesAction(input: unknown): Promise<ActionResult<Page<CommentView>>> {
  return run('listReplies', (h) => listReplies(input, { headers: h }));
}

const text = (data: FormData, name: string): string => {
  const v = data.get(name);
  return typeof v === 'string' ? v : '';
};

/**
 * The comment form's own submit, used before the page's scripts have loaded: it adds the comment
 * and goes back to the post (303). A failure goes back too; the message is only shown by the
 * script path, which keeps the text and reads the error body.
 */
export async function addCommentFormAction(data: FormData): Promise<void> {
  const postId = text(data, 'postId');
  const target = isId(postId) ? `/p/${postId}` : '/';
  const parentId = text(data, 'parentId');
  try {
    await addComment(
      {
        postId,
        body: text(data, 'body'),
        ...(parentId === '' ? {} : { parentId }),
        clientRequestId: text(data, 'clientRequestId'),
      },
      { headers: await headers() },
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    logUnexpected('addComment', error);
  }
  revalidatePath(target);
  redirect(target);
}
