import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getSessionUser } from '@/features/auth';
import { buildOgMeta, getPost, PostDetail, requestOrigin } from '@/features/post';
import { AppError } from '@/shared/errors';

// Anyone may open a post, so this route is outside the (app) group (ADR-0031). The page and
// generateMetadata share one read per request.
const loadPost = cache(async (postId: string) => {
  try {
    return await getPost({ postId }, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
});

type Props = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadPost((await params).postId);
  const og = buildOgMeta(post, requestOrigin(await headers()));
  const images = og.image.url ? [og.image] : undefined;
  return {
    title: og.title,
    description: og.description,
    openGraph: {
      type: 'article',
      title: og.title,
      description: og.description,
      url: og.url,
      images,
    },
    twitter: {
      card: og.twitterCard,
      title: og.title,
      description: og.description,
      images: og.image.url ? [og.image.url] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await loadPost((await params).postId);
  const viewer = await getSessionUser(await headers());
  return <PostDetail post={post} isOwner={viewer?.username === post.author.username} />;
}
