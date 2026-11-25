'use client';

import { useEffect } from 'react';

/**
 * Marks the page as hydrated (`html[data-hydrated="1"]`) so E2E waits for JS-only controls
 * (docs/architecture/conventions.md "ハイドレーション"). Renders nothing.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = '1';
  }, []);
  return null;
}
