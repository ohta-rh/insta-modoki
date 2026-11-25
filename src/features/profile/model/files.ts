const VARIANTS = ['orig', 'w320', 'w640', 'w1080'] as const;

/** The four WebP files stored under a profile image's key (`users.avatar_key`). */
export const avatarFileKeys = (avatarKey: string): string[] =>
  VARIANTS.map((name) => `${avatarKey}/${name}.webp`);
