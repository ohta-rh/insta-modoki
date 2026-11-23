import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { charLength } from '../../../shared/text';
import { MAX_BODY, TOO_LONG_MESSAGE } from './limits';

type SendResult = { ok: true } | { ok: false; error: { message: string } };

export type FeedCommentOutcome =
  { ok: true; requestId: string } | { ok: false; message: string; requestId: string };

/**
 * Sends one comment of the feed card's field. A comment over the limit is not sent. A failure keeps
 * the request id, so the retry of the same text is the same request (the server answers a repeated
 * id with the first result); a success returns a new id for the next comment.
 */
export async function submitFeedComment({
  postId,
  body,
  requestId,
  send,
  newId,
}: {
  postId: string;
  body: string;
  requestId: string;
  send: (input: { postId: string; body: string; clientRequestId: string }) => Promise<SendResult>;
  newId: () => string;
}): Promise<FeedCommentOutcome> {
  if (charLength(body.trim()) > MAX_BODY) {
    return { ok: false, message: TOO_LONG_MESSAGE, requestId };
  }
  try {
    const result = await send({ postId, body, clientRequestId: requestId });
    if (!result.ok) return { ok: false, message: result.error.message, requestId };
    return { ok: true, requestId: newId() };
  } catch {
    return { ok: false, message: INTERNAL_MESSAGE, requestId };
  }
}
