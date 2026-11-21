import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getSessionUser } from '@/features/auth';
import { getRequestEnv } from '@/shared/db/request';
import { listComments } from '@/features/comment';
import { appOrigin, buildOgMeta, getPost, PostDetail } from '@/features/post';
import type { AuthEnv } from '@/features/auth/api/auth-env';
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
  const og = buildOgMeta(post, appOrigin((await getRequestEnv<AuthEnv>()).BETTER_AUTH_URL));
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
  const requestHeaders = await headers();
  const [viewer, comments] = await Promise.all([
    getSessionUser(requestHeaders),
    listComments({ postId: post.id }, { headers: requestHeaders }),
  ]);
  return (
    <PostDetail
      post={post}
      isOwner={viewer?.username === post.author.username}
      viewer={viewer ? { username: viewer.username } : null}
      comments={comments}
      requestId={crypto.randomUUID()}
    />
  );
}
