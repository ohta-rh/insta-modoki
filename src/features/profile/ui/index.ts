// The profile slice's entry for its screens and client components (ADR-0057). Only the routes and
// other slices' components import it; `../index.ts` stays free of `'use client'` modules.
export { PostGrid } from './PostGrid';
export { EditProfileForm } from '../edit/EditProfileForm';
export { PostModal } from './PostModal';
export { ProfilePostsProvider, useDeletedPosts } from './ProfilePostsProvider';
export { ProfileTabs } from './ProfileTabs';
export { SavedGrid } from './SavedGrid';
