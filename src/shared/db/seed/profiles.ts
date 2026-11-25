export type Profile = {
  users: number;
  posts: number;
  demoFollows: number;
  /** When set, posts reuse this many generated images instead of one image per media row. */
  imagePool?: number;
};

export const DEMO: Profile = { users: 30, posts: 300, demoFollows: 20 };
export const BENCH: Profile = { users: 1000, posts: 10000, demoFollows: 100, imagePool: 60 };

export const PROFILES = { demo: DEMO, bench: BENCH } as const;
export type ProfileName = keyof typeof PROFILES;
