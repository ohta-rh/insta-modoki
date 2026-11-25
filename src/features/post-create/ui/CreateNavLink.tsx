'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * The navigation link of 投稿. A `next/link` so pressing it is a soft navigation, which lets the
 * intercepting route open the create modal over the current screen (ADR-0043). With the scripts
 * not loaded yet it is a plain link to the `/create` page.
 */
export function CreateNavLink({ href, ...props }: ComponentProps<'a'>) {
  return <Link {...props} href={href ?? '/create'} prefetch={false} scroll={false} />;
}
