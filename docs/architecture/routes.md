---
type: Architecture
title: 画面の URL とサーバーの処理
description: 全ての画面の URL、サーバーの処理（名前・入力・出力・エラー）、予約したユーザー名。PBI の「実装方針 › 入出力」はこの文書の処理名を参照する。
tags: [architecture, routes, api]
status: stable
---

# 画面の URL とサーバーの処理

ルートのファイルを置く場所は [overview.md](overview.md) の「ルートのファイルの場所」に従う（Next.js の App Router、`src/app/`）。ルートのファイルは薄く、`src/features/<slice>/` の部品を組み合わせるだけにする（[ADR-0014](../adr/0014-code-in-feature-slices.md)）。

## 画面

| URL | 画面 | ログイン | Milestone |
|---|---|---|---|
| `/` | ホームフィード（未ログインは `/accounts/login` へ） | 要 | M1 |
| `/accounts/signup` / `/accounts/login` | サインアップ / ログイン | 不要（ログイン済みは `/` へ） | M1 |
| `/accounts/logout` | ログアウトの確認 | 要 | M1 |
| `/accounts/edit` | プロフィールの編集 | 要 | M1 |
| `/create` | 投稿の作成 | 要 | M1 |
| `/p/[postId]` | 投稿詳細 | 不要 | M1 |
| `/[username]` | プロフィール | 不要 | M1 |
| `/[username]/followers` / `/[username]/following` | フォロワー / フォロー中の一覧 | 不要 | M1 |
| `/admin` | 管理（招待コード・削除・通報） | 管理者 | M2 |
| `/explore` / `/explore/search` / `/explore/tags/[tag]` | 発見 / 検索 / ハッシュタグ | 要 | M3 |
| `/notifications` | 通知 | 要 | M3 |
| `/stories/create` / `/stories/[username]` | ストーリーの投稿 / ビューア | 要 | M3 |
| `/direct` / `/direct/[conversationId]` | DM の一覧 / 会話 | 要 | M4 |
| `/reels` | 縦型動画（任意） | 要 | M4 |
| `/about` | 紹介 | 不要 | M4 |

### 予約したユーザー名

`accounts`、`p`、`create`、`explore`、`notifications`、`stories`、`direct`、`reels`、`admin`、`about`、`api`、`static`、`assets`、`_next`、`favicon.ico`、`robots.txt`、`manifest.webmanifest`、`sw.js`。

## サーバーの処理

全ての処理は `src/features/<slice>/api/<name>.ts` に 1 つずつ置き、入力を Zod のスキーマ（`src/features/<slice>/model/schema.ts`）で検証する。失敗は [conventions.md](conventions.md) の「エラー」の形で返す。「本人」は、セッションの利用者が対象の持ち主であること。

| 処理 | slice | 入力 | 成功 | 主なエラー |
|---|---|---|---|---|
| `signUp` | auth | email, username, displayName, password（8〜72 字）, inviteCode（M2〜） | セッションを作り `{ username }` | VALIDATION、CONFLICT（`username` / `email`）、RATE_LIMITED |
| `checkUsername` | auth | username | `{ available: boolean }` | VALIDATION |
| `logIn` | auth | email, password | セッションを作る | UNAUTHENTICATED（文言は 1 つ）、RATE_LIMITED |
| `logOut` | auth | – | セッションを消す | – |
| `getProfile` | profile | username | `ProfileView`（[conventions.md](conventions.md)） | NOT_FOUND |
| `listProfilePosts` | profile | username, cursor? | `Page<PostThumb>`（12 件） | NOT_FOUND |
| `updateProfile` | profile | displayName, bio, avatarKey? | `ProfileView`（`avatarKey` があれば、`createPost` と同じ所有の検査の後に `HEAD` で `image/webp` と大きさを確かめる） | UNAUTHENTICATED、VALIDATION |
| `requestUploadUrls` | media-upload | files: `{ contentType, size, width, height, variantSizes: { w320, w640, w1080 } }[]`（1〜10。size は縮小後の WebP のバイト数） | `{ uploads: { key, putUrls: { orig, w320, w640, w1080 } }[] }`（有効期限 5 分。署名に `Content-Type: image/webp` と宣言した長さを含める） | UNAUTHENTICATED、VALIDATION、PAYLOAD_TOO_LARGE、RATE_LIMITED |
| `createPost` | post-create | caption, media: `{ key, width, height, altText, thumbhash }[]`（1〜10）, clientRequestId | `{ postId }`（`media[].key` は `^media/<セッションの userId>/<UUIDv7>$` の形で、他の行に参照済みでないこと。違えば何も消さずに VALIDATION。通ったキーを `HEAD` し、`image/webp` でない・宣言より大きいものは拒否して消す） | UNAUTHENTICATED、VALIDATION、RATE_LIMITED |
| `getPost` | post | postId | `PostView` | NOT_FOUND |
| `deletePost` | post | postId | `{ deleted: true }`（既に無い投稿には、ログインしていれば誰にでも同じ結果を返す。持ち主を確かめる対象が無いため） | UNAUTHENTICATED、FORBIDDEN、NOT_FOUND |
| `likePost` / `unlikePost` | like | postId | `{ liked, likeCount }`（何度呼んでも同じ結果） | UNAUTHENTICATED、NOT_FOUND |
| `listLikers` | like | postId, cursor? | `Page<UserSummary>`（20 件） | NOT_FOUND |
| `listReplies` | comment | commentId, cursor? | `Page<CommentView>`（20 件、古い順） | NOT_FOUND |
| `listComments` | comment | postId, cursor? | `Page<CommentView>`（親 20 件、返信は親ごとに最初の 3 件と件数） | NOT_FOUND |
| `addComment` | comment | postId, body, parentId?, clientRequestId | `CommentView` | UNAUTHENTICATED、VALIDATION、NOT_FOUND、RATE_LIMITED |
| `deleteComment` | comment | commentId | `{ deleted: true }` | UNAUTHENTICATED、FORBIDDEN（本人でも投稿者でもない）、NOT_FOUND |
| `follow` / `unfollow` | follow | username | `{ following, followerCount }`（何度呼んでも同じ結果） | UNAUTHENTICATED、VALIDATION（自分自身）、NOT_FOUND |
| `listFollowers` / `listFollowing` | follow | username, cursor? | `Page<UserSummary>`（20 件） | NOT_FOUND |
| `getFeed` | feed | cursor? | `Page<PostView>`（12 件） | UNAUTHENTICATED |

M2 以降の処理は、その PBI が同じ形でこの表に足す。
