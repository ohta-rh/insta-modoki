'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { likeAction } from '../api/actions';
import {
  createLikeController,
  type LikeSnapshot,
  type LikeSendResult,
} from '../model/like-controller';

type LikeContextValue = {
  postId: string;
  snapshot: LikeSnapshot;
  press: () => void;
  like: () => void;
};

const LikeContext = createContext<LikeContextValue | null>(null);

/** The like state of the screen's post, read by LikeButton, DoubleTapLike and LikersDialog. */
export function useLikeScope(): LikeContextValue {
  const value = useContext(LikeContext);
  if (!value) throw new Error('LikeScope がありません');
  return value;
}

const send =
  (postId: string) =>
  async (liked: boolean): Promise<LikeSendResult> => {
    const result = await likeAction({ postId, liked });
    return result.ok
      ? { ok: true, liked: result.liked, likeCount: result.likeCount }
      : { ok: false, code: result.error.code, message: result.error.message };
  };

/**
 * Holds one optimistic like state for a post (`model/like-controller.ts`) so the heart button,
 * the double tap on the photos and the count all show the same thing.
 */
export function LikeScope({
  postId,
  initialLiked,
  initialCount,
  children,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<LikeSnapshot>({
    liked: initialLiked,
    count: initialCount,
    error: null,
    needsLogin: false,
    touched: 0,
  });
  const controller = useRef<ReturnType<typeof createLikeController> | null>(null);
  if (controller.current === null) {
    controller.current = createLikeController({
      initial: { liked: initialLiked, count: initialCount },
      send: send(postId),
      onChange: setSnapshot,
    });
  }
  const ctl = controller.current;

  // Not signed in: the optimistic state has been undone; go to the login page.
  useEffect(() => {
    if (snapshot.needsLogin) window.location.assign('/accounts/login');
  }, [snapshot.needsLogin]);

  return (
    <LikeContext.Provider value={{ postId, snapshot, press: ctl.press, like: ctl.like }}>
      {children}
    </LikeContext.Provider>
  );
}
