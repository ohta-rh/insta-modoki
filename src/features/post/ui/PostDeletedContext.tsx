'use client';

import { createContext, useContext } from 'react';

const PostDeletedContext = createContext<((postId: string) => void) | null>(null);

/**
 * A screen that shows a post inside something else (the profile's modal) provides what happens
 * after the author deletes it; without a provider, the delete button goes to the author's page.
 */
export const PostDeletedProvider = PostDeletedContext.Provider;

export function usePostDeletedHandler() {
  return useContext(PostDeletedContext);
}
