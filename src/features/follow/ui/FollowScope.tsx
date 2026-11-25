'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { followAction } from '../api/actions';
import {
  createFollowController,
  type FollowSendResult,
  type FollowSnapshot,
} from '../model/follow-controller';

type FollowContextValue = {
  username: string;
  signedIn: boolean;
  snapshot: FollowSnapshot;
  press: () => void;
};

const FollowContext = createContext<FollowContextValue | null>(null);

/** The follow state of the screen's profile, read by FollowButton and FollowerCount. */
export function useFollowScope(): FollowContextValue {
  const value = useContext(FollowContext);
  if (!value) throw new Error('FollowScope がありません');
  return value;
}

const send =
  (username: string) =>
  async (following: boolean): Promise<FollowSendResult> => {
    const result = await followAction({ username, following });
    return result.ok
      ? { ok: true, following: result.following, followerCount: result.followerCount }
      : { ok: false, code: result.error.code, message: result.error.message };
  };

/**
 * Holds one optimistic follow state for a profile (`model/follow-controller.ts`) so the button and
 * the follower count in the header show the same thing.
 */
export function FollowScope({
  username,
  initialFollowing,
  initialFollowerCount,
  signedIn,
  children,
}: {
  username: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  signedIn: boolean;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<FollowSnapshot>({
    following: initialFollowing,
    count: initialFollowerCount,
    error: null,
    needsLogin: false,
    touched: 0,
  });
  const controller = useRef<ReturnType<typeof createFollowController> | null>(null);
  if (controller.current === null) {
    controller.current = createFollowController({
      initial: { following: initialFollowing, count: initialFollowerCount },
      send: send(username),
      onChange: setSnapshot,
    });
  }
  const ctl = controller.current;

  // Not signed in: the optimistic state has been undone; go to the login page.
  useEffect(() => {
    if (snapshot.needsLogin) window.location.assign('/accounts/login');
  }, [snapshot.needsLogin]);

  return (
    <FollowContext.Provider value={{ username, signedIn, snapshot, press: ctl.press }}>
      {children}
    </FollowContext.Provider>
  );
}
