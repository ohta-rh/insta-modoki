import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { logUnexpected } from '../../../shared/action';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError, toErrorResponse } from '../../../shared/errors';
import { countUnread, latestNotificationKey } from '../db/unread';
import {
  encodeUnreadEvent,
  PING_LINE,
  STREAM_PING_MS,
  STREAM_RETRY_MS,
  STREAM_TICK_MS,
  STREAM_WINDOW_MS,
} from '../model/sse';

export type StreamDeps = {
  env?: AuthEnv;
  /** Overridable so tests can run the whole window in real time. */
  intervals?: { tickMs: number; pingMs: number; windowMs: number };
};

/**
 * `GET /api/notifications/stream` (ADR-0050): the signed-in user's unread count as server-sent
 * events. It sends the current count at once, then again only when it changes, a ping line every
 * `pingMs`, and ends after `windowMs` (the browser's EventSource reconnects). Every `tickMs` it
 * reads the newest notification row of this user and counts only when that row changed. All state
 * is local to this one response.
 */
export async function streamNotifications(
  request: Request,
  deps: StreamDeps = {},
): Promise<Response> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const user = await getSessionUser(request.headers, { env });
  if (!user) {
    const { status, body } = toErrorResponse(new AppError('UNAUTHENTICATED'));
    return Response.json(body, { status });
  }
  const { tickMs, pingMs, windowMs } = deps.intervals ?? {
    tickMs: STREAM_TICK_MS,
    pingMs: STREAM_PING_MS,
    windowMs: STREAM_WINDOW_MS,
  };
  const db = getDb(env);
  const encoder = new TextEncoder();
  let stop = () => {};

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let busy = false;
      let key: string | null = null;
      let count = -1;
      const timers: ReturnType<typeof setInterval>[] = [];
      const write = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      stop = () => {
        if (closed) return;
        closed = true;
        timers.forEach((t) => clearInterval(t));
        request.signal.removeEventListener('abort', stop);
        try {
          controller.close();
        } catch {
          // already cancelled by the reader
        }
      };
      request.signal.addEventListener('abort', stop);
      if (request.signal.aborted) return stop();

      try {
        key = await latestNotificationKey(db, user.id);
        count = await countUnread(db, user.id);
      } catch (error) {
        logUnexpected('streamNotifications', error);
        return stop();
      }
      write(`retry: ${STREAM_RETRY_MS}\n\n${encodeUnreadEvent(count)}`);

      timers.push(
        setInterval(async () => {
          if (busy || closed) return;
          busy = true;
          try {
            const latest = await latestNotificationKey(db, user.id);
            if (latest !== key) {
              const next = await countUnread(db, user.id);
              key = latest;
              if (next !== count && !closed) {
                count = next;
                write(encodeUnreadEvent(next));
              }
            }
          } catch (error) {
            logUnexpected('streamNotifications', error);
            stop();
          } finally {
            busy = false;
          }
        }, tickMs),
        setInterval(() => write(PING_LINE), pingMs),
        // An interval, so that `stop` clears every timer the same way.
        setInterval(stop, windowMs),
      );
    },
    cancel() {
      stop();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
