import type { ReactNode } from 'react';
import { ProfilePostsProvider } from '@/features/profile/ui';

// `modal` is the parallel slot where a post opened from the grid is shown over the profile
// (ADR-0043). The provider lets the modal tell the grid a post was deleted.
export default function ProfileLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <ProfilePostsProvider>
      {children}
      {modal}
    </ProfilePostsProvider>
  );
}
