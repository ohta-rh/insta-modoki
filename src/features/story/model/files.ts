// No imports: the scheduled job loads this file outside the app's module resolution (.ts suffixes).
const PHOTO_FILES = ['orig', 'w320', 'w640', 'w1080'].map((n) => `${n}.webp`);

/** The object keys a story's `storage_key` stands for (derived from its type, never listed). */
export const storyFileKeys = (type: string, storageKey: string): string[] =>
  type === 'video' ? [`${storageKey}/video.mp4`] : PHOTO_FILES.map((f) => `${storageKey}/${f}`);
