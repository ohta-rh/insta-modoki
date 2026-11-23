'use client';

import { useEffect, useState, type RefObject } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../shared/ui/icons';

const ITEM_WIDTH = 80;
const WIDE = '(min-width: 768px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * The "前へ" / "次へ" buttons over the tray's ends (wide screens only; on a narrow screen a finger
 * moves the tray). A button shows only while the tray can move that way. A press moves the tray by
 * its width minus one item, in one jump when the viewer asked for reduced motion.
 */
export function TrayArrows({ listRef }: { listRef: RefObject<HTMLUListElement | null> }) {
  const [state, setState] = useState({ wide: false, prev: false, next: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const wide = window.matchMedia(WIDE);
    const update = () =>
      setState({
        wide: wide.matches,
        prev: list.scrollLeft > 0,
        next: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
      });
    update();
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      list.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [listRef]);

  if (!state.wide) return null;
  const move = (direction: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    const reduce = window.matchMedia(REDUCE).matches;
    list.scrollBy({
      left: direction * (list.clientWidth - ITEM_WIDTH),
      behavior: reduce ? 'auto' : 'smooth',
    });
  };
  return (
    <>
      {state.prev ? (
        <Arrow label="前へ" side="left-1" onPress={() => move(-1)}>
          <ChevronLeftIcon size={16} />
        </Arrow>
      ) : null}
      {state.next ? (
        <Arrow label="次へ" side="right-1" onPress={() => move(1)}>
          <ChevronRightIcon size={16} />
        </Arrow>
      ) : null}
    </>
  );
}

function Arrow({
  label,
  side,
  onPress,
  children,
}: {
  label: string;
  side: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className={`absolute top-[19px] ${side} flex h-[var(--tap-min)] w-[var(--tap-min)] items-center justify-center`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-icon shadow-[var(--shadow-panel)]">
        {children}
      </span>
    </button>
  );
}
