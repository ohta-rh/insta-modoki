'use client';

import { useFollowScope } from './FollowScope';

/** The follower number of the header, which moves with the follow button. */
export function FollowerCount() {
  const { snapshot } = useFollowScope();
  return <>{snapshot.count}</>;
}
