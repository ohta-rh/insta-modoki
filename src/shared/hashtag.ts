import { charLength } from './text';

// Hashtag rules shared by post-create, hashtag, post and CaptionText (no zod: ADR-0046).
// A tag starts with a half-width `#` that is not in the middle of a word or a URL.
const PATTERN_SOURCE = String.raw`(?<![\p{L}\p{N}\p{M}_/])#([\p{L}\p{N}\p{M}_]+)`;
export const HASHTAG_PATTERN = new RegExp(PATTERN_SOURCE, 'gu');

export const MAX_HASHTAGS = 30;
export const MAX_HASHTAG_LENGTH = 100;
export const HASHTAG_COUNT_MESSAGE = 'ハッシュタグは 30 個までです';
export const HASHTAG_LENGTH_MESSAGE = 'ハッシュタグは 100 字までです';

const TAG_NAME = /^[\p{L}\p{N}\p{M}_]+$/u;

/** The stored form of a tag: NFKC, lower case. */
export const normalizeTag = (raw: string): string => raw.normalize('NFKC').toLowerCase();

/** Whether `name` (already normalized) can be a stored tag: 1 to 100 letters, digits, marks, `_`. */
export function isTagName(name: string): boolean {
  const length = charLength(name);
  return TAG_NAME.test(name) && length >= 1 && length <= MAX_HASHTAG_LENGTH;
}

/** The distinct tag names of a caption, normalized, in order of first appearance. */
export function extractHashtags(caption: string): string[] {
  const names = new Set<string>();
  for (const match of caption.matchAll(HASHTAG_PATTERN)) names.add(normalizeTag(match[1]!));
  return [...names];
}

export type CaptionPart =
  { type: 'text'; text: string } | { type: 'tag'; text: string; name: string };

/**
 * Splits a caption into plain text and tags, keeping every character as written. A tag longer
 * than 100 characters after normalizing (a post from before the limit) stays plain text.
 */
export function parseCaption(caption: string): CaptionPart[] {
  const parts: CaptionPart[] = [];
  const pushText = (text: string) => {
    if (text === '') return;
    const last = parts[parts.length - 1];
    if (last?.type === 'text') last.text += text;
    else parts.push({ type: 'text', text });
  };
  let at = 0;
  for (const match of caption.matchAll(HASHTAG_PATTERN)) {
    const name = normalizeTag(match[1]!);
    pushText(caption.slice(at, match.index));
    if (charLength(name) > MAX_HASHTAG_LENGTH) pushText(match[0]);
    else parts.push({ type: 'tag', text: match[0], name });
    at = match.index + match[0].length;
  }
  pushText(caption.slice(at));
  return parts;
}
