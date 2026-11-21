import type { Profile } from './profiles.ts';

/** The one seed every run uses, so the same profile always yields the same data (AC-6). */
export const SEED = 20261121;
/** The fixed base date posts are counted from: 2026-11-01T00:00:00Z. */
export const BASE_TIME_MS = Date.UTC(2026, 10, 1);
/** Each post is one step after the previous one. */
export const POST_STEP_MS = 60_000;

export type GenUser = {
  username: string;
  displayName: string;
  email: string;
  bio: string;
  createdAt: number;
};
export type GenPost = {
  authorIndex: number;
  caption: string;
  createdAt: number;
  mediaCount: number;
};
/** One media row: which image (an index into the generated images) and where it sits in the post. */
export type GenMedia = { postIndex: number; position: number; imageIndex: number };
export type GenLike = { userIndex: number; postIndex: number; createdAt: number };
export type GenComment = {
  postIndex: number;
  authorIndex: number;
  body: string;
  createdAt: number;
  /** Index into `comments` of a top-level comment on the same post; null for a top-level one. */
  parentIndex: number | null;
};
export type GenFollow = { followerIndex: number; followeeIndex: number; createdAt: number };
export type Dataset = {
  users: GenUser[];
  posts: GenPost[];
  media: GenMedia[];
  likes: GenLike[];
  comments: GenComment[];
  follows: GenFollow[];
  /** How many distinct images the media rows point at. */
  imageCount: number;
};

/** mulberry32: a small seeded generator returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

function sample(rng: Rng, size: number, count: number, exclude = -1): number[] {
  const chosen = new Set<number>();
  const limit = exclude >= 0 && exclude < size ? size - 1 : size;
  const want = Math.min(count, limit);
  while (chosen.size < want) {
    const n = Math.floor(rng() * size);
    if (n !== exclude) chosen.add(n);
  }
  return [...chosen];
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

const DISPLAY_NAMES = [
  'デモ 太郎',
  'あおい',
  'さくら',
  'はると',
  'ゆうき',
  'みなと',
  'りん',
  'そうた',
  'ひなた',
  'めい',
  'かいと',
  'ことは',
  'れん',
  'つむぎ',
  'いつき',
  'なぎさ',
  'あきら',
  'ほのか',
  'しずく',
  'たくみ',
  'みお',
  'こうき',
  'ふうか',
  'だいち',
  'ゆいな',
  'はるか',
  'しょうた',
  'ののか',
  'りくと',
  'あかり',
] as const;

const SUBJECTS = [
  '朝の散歩',
  '近所のカフェ',
  '週末の写真',
  '夕焼けの空',
  '新しい本棚',
  '雨上がりの道',
  '手作りの昼ごはん',
  '窓辺の植物',
  '古い商店街',
  '海沿いの駅',
] as const;
const FEELINGS = [
  'ゆっくり過ごせた',
  '少し肌寒かった',
  'お気に入りの一枚',
  '思ったより静かだった',
  'また行きたい',
  '光がきれいだった',
] as const;
const BIOS = ['写真を撮るのが好きです', '散歩と本と珈琲', '週末はだいたい外にいます', ''] as const;
const COMMENTS = [
  'いい色ですね',
  'この構図、好きです',
  '静かな雰囲気がいいですね',
  '私も行ってみたいです',
  '光がきれいです',
  'ほっとする一枚です',
  '細かいところまで素敵です',
] as const;
const REPLIES = ['ありがとうございます', 'ぜひ行ってみてください', 'うれしいです', 'また撮ります'] as const;

/** The count of media in each post: mostly 1, some 2-5, and about 1% with the maximum of 10. */
function mediaCounts(rng: Rng, posts: number): number[] {
  const tens = Math.max(1, Math.round(posts * 0.01));
  const ones = Math.round(posts * 0.8);
  const counts: number[] = [];
  for (let i = 0; i < posts; i += 1) {
    counts.push(i < ones ? 1 : i < ones + (posts - ones - tens) ? int(rng, 2, 5) : 10);
  }
  return shuffle(rng, counts);
}

export function generateDataset(profile: Profile, seed: number = SEED): Dataset {
  const rng = mulberry32(seed);
  const { users: userCount, posts: postCount } = profile;

  const users: GenUser[] = [];
  for (let i = 0; i < userCount; i += 1) {
    const username = i === 0 ? 'demo' : `seed_user_${String(i).padStart(2, '0')}`;
    users.push({
      username,
      displayName: DISPLAY_NAMES[i % DISPLAY_NAMES.length]!,
      email: `${username}@seed.invalid`,
      bio: pick(rng, BIOS),
      createdAt: BASE_TIME_MS - (userCount - i) * 3_600_000,
    });
  }

  const posts: GenPost[] = [];
  const media: GenMedia[] = [];
  const counts = mediaCounts(rng, postCount);
  let nextImage = 0;
  for (let i = 0; i < postCount; i += 1) {
    const mediaCount = counts[i]!;
    posts.push({
      authorIndex: i % userCount,
      caption: `${pick(rng, SUBJECTS)}。${pick(rng, FEELINGS)}。`,
      createdAt: BASE_TIME_MS + i * POST_STEP_MS,
      mediaCount,
    });
    const pool = profile.imagePool;
    const chosen = pool === undefined ? null : sample(rng, pool, mediaCount);
    for (let position = 0; position < mediaCount; position += 1) {
      media.push({
        postIndex: i,
        position,
        imageIndex: chosen ? chosen[position]! : nextImage++,
      });
    }
  }
  const imageCount = profile.imagePool ?? nextImage;

  const likes: GenLike[] = [];
  const comments: GenComment[] = [];
  for (let p = 0; p < postCount; p += 1) {
    const at = posts[p]!.createdAt;
    for (const userIndex of sample(rng, userCount, int(rng, 0, 12))) {
      likes.push({ userIndex, postIndex: p, createdAt: at + int(rng, 1, 600) * 60_000 });
    }
    const topLevel: number[] = [];
    let commentAt = at;
    for (let c = int(rng, 0, 6); c > 0; c -= 1) {
      const isReply = topLevel.length > 0 && rng() < 0.3;
      commentAt += int(rng, 1, 60) * 60_000; // a reply is never older than its parent
      comments.push({
        postIndex: p,
        authorIndex: int(rng, 0, userCount - 1),
        body: isReply ? pick(rng, REPLIES) : pick(rng, COMMENTS),
        createdAt: commentAt,
        parentIndex: isReply ? pick(rng, topLevel) : null,
      });
      if (!isReply) topLevel.push(comments.length - 1);
    }
  }

  const follows: GenFollow[] = [];
  for (let u = 0; u < userCount; u += 1) {
    const want = u === 0 ? profile.demoFollows : int(rng, 5, 15);
    for (const followeeIndex of sample(rng, userCount, want, u)) {
      follows.push({
        followerIndex: u,
        followeeIndex,
        createdAt: BASE_TIME_MS + int(rng, 0, 100_000) * 60_000,
      });
    }
  }

  return { users, posts, media, likes, comments, follows, imageCount };
}
