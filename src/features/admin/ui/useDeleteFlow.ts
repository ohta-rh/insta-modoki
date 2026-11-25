'use client';

import { useState } from 'react';
import {
  createDeleteController,
  type DeleteController,
  type DeleteSnapshot,
} from '../model/delete-controller';

/** React's side of `createDeleteController`: the controller lives once, every change re-renders. */
export function useDeleteFlow<R>(
  options: Omit<Parameters<typeof createDeleteController<R>>[0], 'onChange'>,
): { snapshot: DeleteSnapshot<R>; controller: DeleteController<R> } {
  const [snap, setSnap] = useState<DeleteSnapshot<R> | null>(null);
  const [controller] = useState(() =>
    createDeleteController<R>({ ...options, onChange: (s) => setSnap(s) }),
  );
  return { snapshot: snap ?? controller.snapshot(), controller };
}
