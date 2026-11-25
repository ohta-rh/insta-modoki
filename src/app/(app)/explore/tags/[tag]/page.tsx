import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { listTagPosts } from '@/features/hashtag';
import { TagPage } from '@/features/hashtag/ui';
import { AppError } from '@/shared/errors';

// The tag's name in the URL is percent-encoded (a Japanese tag is). Tag names never contain `%`,
// so decoding once, and only when an escape is there, cannot decode twice.
function readTag(raw: string): string | null {
  if (!/%[0-9a-fA-F]{2}/.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

// The page and generateMetadata share one read per request.
const load = cache(async (raw: string) => {
  const tag = readTag(raw);
  if (tag === null) notFound();
  try {
    return await listTagPosts({ tag }, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    throw error;
  }
});

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).tag);
  return { title: `#${page.name}` };
}

export default async function TagRoute({ params }: Props) {
  const page = await load((await params).tag);
  return (
    <TagPage
      name={page.name}
      postCount={page.postCount}
      initialItems={page.items}
      initialCursor={page.nextCursor}
    />
  );
}
