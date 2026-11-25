'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Deleted = { ids: ReadonlySet<string>; markDeleted: (postId: string) => void };

const EMPTY: Deleted = { ids: new Set(), markDeleted: () => {} };
const DeletedPostsContext = createContext<Deleted>(EMPTY);

/**
 * Shared by the profile page (the grid) and its modal slot, which are separate trees under the
 * [username] layout: a post deleted in the modal is removed from the grid without a reload.
 */
export function ProfilePostsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const markDeleted = useCallback(
    (postId: string) => setIds((prev) => new Set(prev).add(postId)),
    [],
  );
  const value = useMemo(() => ({ ids, markDeleted }), [ids, markDeleted]);
  return <DeletedPostsContext.Provider value={value}>{children}</DeletedPostsContext.Provider>;
}

export function useDeletedPosts(): Deleted {
  return useContext(DeletedPostsContext);
}
