import { INTERNAL_MESSAGE } from '../../../shared/errors';

export type SaveState = { saved: boolean };
export type SaveSendResult =
  { ok: true; saved: boolean } | { ok: false; code: string; message: string };
export type SaveSnapshot = SaveState & {
  /** The message of the last failure (shown in role="alert"), or null. */
  error: string | null;
  /** The last failure was UNAUTHENTICATED: the screen sends the person to the login page. */
  needsLogin: boolean;
  /** Counts up on every change a person made, so a screen can tell "just changed" from "loaded". */
  touched: number;
};

export type SaveControllerOptions = {
  initial: SaveState;
  /** Sends the wanted state to the server (a request that never throws). */
  send: (saved: boolean) => Promise<SaveSendResult>;
  onChange: (snapshot: SaveSnapshot) => void;
};

/**
 * The optimistic state of one save button (the like controller without a count). A press flips
 * the shown state at once; only one request is in flight, and while it runs presses only change
 * the wanted state, so when it ends one more request is sent only if the server's answer differs
 * from what is wanted (the server operations are "make it so"). A failure goes back to the last
 * state the server confirmed and keeps the server's message.
 */
export function createSaveController({ initial, send, onChange }: SaveControllerOptions) {
  let confirmed = initial.saved;
  let wanted = initial.saved;
  let inFlight = false;
  let error: string | null = null;
  let needsLogin = false;
  let touched = 0;

  const snapshot = (): SaveSnapshot => ({ saved: wanted, error, needsLogin, touched });
  const emit = () => onChange(snapshot());

  const flush = async () => {
    if (inFlight || wanted === confirmed) return;
    inFlight = true;
    let result: SaveSendResult;
    try {
      result = await send(wanted);
    } catch {
      result = { ok: false, code: 'INTERNAL', message: INTERNAL_MESSAGE };
    }
    inFlight = false;
    if (result.ok) {
      confirmed = result.saved;
      emit();
      void flush();
      return;
    }
    wanted = confirmed;
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
