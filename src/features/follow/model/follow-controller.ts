import { INTERNAL_MESSAGE } from '../../../shared/errors';

export type FollowState = { following: boolean; count: number };
export type FollowSendResult =
  | { ok: true; following: boolean; followerCount: number }
  | { ok: false; code: string; message: string };
export type FollowSnapshot = FollowState & {
  /** The message of the last failure (shown in role="alert"), or null. */
  error: string | null;
  /** The last failure was UNAUTHENTICATED: the screen sends the person to the login page. */
  needsLogin: boolean;
  /** Counts up on every change a person made, so a screen can tell "just changed" from "loaded". */
  touched: number;
};

export type FollowControllerOptions = {
  initial: FollowState;
  /** Sends the wanted state to the server (a request that never throws). */
  send: (following: boolean) => Promise<FollowSendResult>;
  onChange: (snapshot: FollowSnapshot) => void;
};

/**
 * The optimistic state of one follow button. A press flips the shown state at once; only one
 * request is in flight, and while it runs presses only change the wanted state, so when it ends
 * one more request is sent only if the server's answer differs from what is wanted (the server
 * operations are "make it so", so a repeat is harmless). A failure goes back to the last state the
 * server confirmed and keeps the server's message.
 */
export function createFollowController({ initial, send, onChange }: FollowControllerOptions) {
  let confirmed: FollowState = { ...initial };
  let wanted = initial.following;
  let inFlight = false;
  let error: string | null = null;
  let needsLogin = false;
  let touched = 0;

  const snapshot = (): FollowSnapshot => {
    // While a request is pending the count is the confirmed count moved by this person's own follow.
    const delta = wanted === confirmed.following ? 0 : wanted ? 1 : -1;
    return {
      following: wanted,
      count: Math.max(confirmed.count + delta, 0),
      error,
      needsLogin,
      touched,
    };
  };
  const emit = () => onChange(snapshot());

  const flush = async () => {
    if (inFlight || wanted === confirmed.following) return;
    inFlight = true;
    let result: FollowSendResult;
    try {
      result = await send(wanted);
    } catch {
      result = {
        ok: false,
        code: 'INTERNAL',
        message: INTERNAL_MESSAGE,
      };
    }
    inFlight = false;
    if (result.ok) {
      confirmed = { following: result.following, count: result.followerCount };
      emit();
      void flush();
      return;
    }
    wanted = confirmed.following;
    error = result.message;
    needsLogin = result.code === 'UNAUTHENTICATED';
    emit();
  };

  return {
    snapshot,
    /** A button press: flips the wanted state. */
    press: () => {
      wanted = !wanted;
      error = null;
      needsLogin = false;
      touched += 1;
      emit();
      void flush();
    },
  };
}
