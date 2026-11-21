'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { CommentIcon } from '../../../shared/ui/icons';
import { COMMENT_INPUT_ID } from './CommentForm';

type Counter = { count: number; add: (delta: number) => void };
const CountContext = createContext<Counter | null>(null);

/**
 * Holds the post's comment count for the action row's link and the comment section, which sit in
 * different places of the screen: adding or deleting a comment moves both.
 */
export function CommentCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  const add = (delta: number) => setCount((c) => Math.max(0, c + delta));
  return <CountContext value={{ count, add }}>{children}</CountContext>;
}

/** The count and how to change it; without a provider, changes are ignored. */
export function useCommentCount(): Counter {
  return useContext(CountContext) ?? { count: 0, add: () => {} };
}

/**
 * The `comment` slot of the action row: jumps to the comment box, or (with `href`, on a screen
 * that has no comment box, like the feed) opens the post's own screen.
 */
export function CommentCountLink({ href }: { href?: string } = {}) {
  const { count } = useCommentCount();
  return (
    <a
      href={href ?? `#${COMMENT_INPUT_ID}`}
      aria-label={`コメント ${count} 件`}
      className="flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center gap-1 rounded-lg px-2 text-text"
    >
      <CommentIcon />
      <span className="text-[length:var(--font-size-sm)] tabular-nums">{count}</span>
    </a>
  );
}
