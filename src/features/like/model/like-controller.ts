import { INTERNAL_MESSAGE } from '../../../shared/errors';

export type LikeState = { liked: boolean; count: number };
export type LikeSendResult =
  { ok: true; liked: boolean; likeCount: number } | { ok: false; code: string; message: string };
export type LikeSnapshot = LikeState & {
  /** The message of the last failure (shown in role="alert"), or null. */
  error: string | null;
  /** The last failure was UNAUTHENTICATED: the screen sends the person to the login page. */
  needsLogin: boolean;
  /** Counts up on every change a person made, so a screen can tell "just changed" from "loaded". */
  touched: number;
};

export type LikeControllerOptions = {
  initial: LikeState;
  /** Sends the wanted state to the server (a request that never throws). */
  send: (liked: boolean) => Promise<LikeSendResult>;
  onChange: (snapshot: LikeSnapshot) => void;
};

/**
 * The optimistic state of one like button. A press flips the shown state at once; only one request
 * is in flight, and while it runs presses only change the wanted state, so when it ends one more
 * request is sent only if the server's answer differs from what is wanted (the server operations
 * are "make it so", so a repeat is harmless). A failure goes back to the last state the server
 * confirmed and keeps the server's message.
 */
export function createLikeController({ initial, send, onChange }: LikeControllerOptions) {
  let confirmed: LikeState = { ...initial };
  let wanted = initial.liked;
  let inFlight = false;
  let error: string | null = null;
  let needsLogin = false;
  let touched = 0;

  const snapshot = (): LikeSnapshot => {
    // The count shown while a request is pending is the confirmed count moved by this person's own like.
    const delta = wanted === confirmed.liked ? 0 : wanted ? 1 : -1;
    return {
      liked: wanted,
      count: Math.max(confirmed.count + delta, 0),
      error,
      needsLogin,
      touched,
    };
  };
  const emit = () => onChange(snapshot());

  const flush = async () => {
    if (inFlight || wanted === confirmed.liked) return;
    inFlight = true;
    const sending = wanted;
    let result: LikeSendResult;
    try {
      result = await send(sending);
    } catch {
      result = {
        ok: false,
        code: 'INTERNAL',
        message: INTERNAL_MESSAGE,
      };
    }
    inFlight = false;
    if (result.ok) {
      confirmed = { liked: result.liked, count: result.likeCount };
      emit();
      void flush();
      return;
    }
    wanted = confirmed.liked;
    error = result.message;
    needsLogin = result.code === 'UNAUTHENTICATED';
    emit();
  };

  /** Asks for the state `liked`; asking for the state already wanted does nothing. */
  const set = (liked: boolean) => {
    if (liked === wanted) return;
    wanted = liked;
    error = null;
    needsLogin = false;
    touched += 1;
    emit();
    void flush();
  };

  return {
    snapshot,
    /** A button press: flips the wanted state. */
    press: () => set(!wanted),
    /** A double tap: likes, never unlikes. */
    like: () => set(true),
  };
}
