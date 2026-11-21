import type { PostView } from './schema';

export type OgMeta = {
  title: string;
  description: string;
  image: { url: string; width: number; height: number };
  url: string;
  twitterCard: 'summary_large_image';
};

const DESCRIPTION_LENGTH = 160;
const IMAGE_MAX_WIDTH = 1080;

/**
 * The social-card values of a post. Pure: values are returned as they are (a quote or "<" in a
 * caption stays text); the page hands them to Next.js, which escapes them when it writes the tags.
 * `origin` is the origin of the request, e.g. https://app.example.
 */
export function buildOgMeta(post: PostView, origin: string): OgMeta {
  const username = post.author.username;
  const caption = post.caption.replace(/\s+/g, ' ').trim();
  const description =
    caption === ''
      ? `@${username} の写真 ${post.media.length} 枚`
      : Array.from(caption).slice(0, DESCRIPTION_LENGTH).join('');

  const first = post.media[0];
  // The w1080 file is as wide as the original up to 1080px; its height keeps the aspect ratio.
  const width = first ? Math.min(IMAGE_MAX_WIDTH, first.width) : 0;
  const height = first ? Math.round((width * first.height) / first.width) : 0;
  return {
    title: `@${username} の投稿`,
    description,
    image: { url: first ? new URL(first.srcset.w1080, origin).href : '', width, height },
    url: `${origin}/p/${post.id}`,
    twitterCard: 'summary_large_image',
  };
}

const FALLBACK_ORIGIN = 'http://localhost';

/**
 * The origin the request came to, from its Host and x-forwarded-proto headers. Without a
 * protocol, localhost is http and anything else https. A missing or malformed host gives
 * http://localhost, so a forged header can only change the tags of the response it was sent with.
 */
export function requestOrigin(headers: Pick<Headers, 'get'>): string {
  const host = headers.get('host');
  if (!host) return FALLBACK_ORIGIN;
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto =
    forwarded === 'http' || forwarded === 'https' ? forwarded : local ? 'http' : 'https';
  try {
    const url = new URL(`${proto}://${host}`);
    return url.host === host.toLowerCase() ? `${proto}://${url.host}` : FALLBACK_ORIGIN;
  } catch {
    return FALLBACK_ORIGIN;
  }
}
