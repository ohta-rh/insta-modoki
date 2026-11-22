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
| `/[username]` | プロフィール。タブは「投稿」と、本人だけの「保存済み」（`?tab=saved`。本人以外・他の値は「投稿」になり、保存は読まない）。グリッドの投稿を押すと `/p/[postId]` がモーダルで開く（intercepting route。直接開く・再読み込みは通常の投稿詳細。[ADR-0043](../adr/0043-profile-grid-modal-by-intercepting-route.md)） | 不要 | M1 |
| `/[username]/followers` / `/[username]/following` | フォロワー / フォロー中の一覧 | 不要 | M1 |
| `/admin` | 管理（招待コード・削除・通報） | 管理者 | M2 |
| `/explore` / `/explore/search` / `/explore/tags/[tag]` | 発見 / 検索 / ハッシュタグ | 要 | M3 |
| `/notifications` | 通知 | 要 | M3 |
| `/stories/create` / `/stories/[username]` | ストーリーの投稿 / ビューア（ホームなど `(app)` の画面から開くとモーダルで重なる（intercepting route。直接開く・再読み込みは全画面）） | 要 | M3 |
| `/direct` / `/direct/[conversationId]` | DM の一覧 / 会話 | 要 | M4 |
| `/reels` | 縦型動画（任意） | 要 | M4 |
| `/e2e-harness/upload` | 写真の選択部品の確認用（E2E 用。`E2E_HARNESS=1`（Playwright の webServer だけが渡す）で、かつ `APP_ENV` が `production` でないときだけ表示。それ以外は 404） | 不要 | M1 |
| `/e2e-harness/db`（POST） | E2E の準備の書き込み（利用者・投稿・フォロー・コメント・回数制限の行）を、アプリ自身の D1 の束縛で行う。JSON で名前つきの操作を 1 つ受け取り、SQL は受け取らない。`/e2e-harness/upload` と同じ条件（`E2E_HARNESS=1` で、かつ `APP_ENV` が `production` でない）のときだけ動き、それ以外は 404（[ADR-0041](../adr/0041-e2e-setup-writes-go-through-the-app.md)） | 不要 | M1 |
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
| `requestUploadUrls` | media-upload | files: `{ contentType, size, width, height, variantSizes: { orig, w320, w640, w1080 } }[]`（1〜10。`contentType`・`size` は選んだ元の写真の形式と大きさ、`width`・`height` は縮小後の原本の画素数、`variantSizes` は変換後の WebP のバイト数。`key` は入力に無く、サーバーが作る） | `{ uploads: { key, putUrls: { orig, w320, w640, w1080 } }[] }`（有効期限 5 分。署名に `Content-Type: image/webp` と宣言した長さを含める） | UNAUTHENTICATED、VALIDATION、PAYLOAD_TOO_LARGE、RATE_LIMITED |
| `createPost` | post-create | caption, media: `{ key, width, height, altText, thumbhash }[]`（1〜10）, clientRequestId | `{ postId }`（`media[].key` は `^media/<セッションの userId>/<UUIDv7>$` の形で、他の行に参照済みでないこと。違えば何も消さずに VALIDATION。通ったキーを `HEAD` し、`image/webp` でない・宣言より大きいものは拒否して消す。同じ `clientRequestId` の同時の 2 回は、どちらも 1 時間 30 件の数に入ることがある（連打で最大 +1。投稿は 1 件）。同じキーを別の投稿が同時に使うと、先の 1 件だけが通り、後は VALIDATION。キャプションのタグを同じ batch で保存する。タグは 30 個まで・1 個 100 字まで、超えれば行も回数制限も使わず VALIDATION） | UNAUTHENTICATED、VALIDATION、RATE_LIMITED |
| `requestStoryUpload` | story | `{ kind: 'image', files: [UploadFile] }`（1 件。`UploadFile` は `requestUploadUrls` と同じ形）または `{ kind: 'video', contentType: 'video/mp4', size, durationMs }`（`durationMs` は 15,000 以下。`size` は 31,457,280 以下） | 写真 `{ key, putUrls: { orig, w320, w640, w1080 } }`（`image/webp`・宣言した長さで署名）、動画 `{ key, putUrls: { video } }`（`video/mp4`・`size` で署名）。`key` は `stories/<セッションの userId>/<UUIDv7>`、有効期限 5 分。枠は写真の投稿と同じ `upload:user:<id>`（1 回 1 枚と数える） | UNAUTHENTICATED、VALIDATION、PAYLOAD_TOO_LARGE、RATE_LIMITED |
| `createStory` | story | key, type（`'image'` / `'video'`）, width?, height?, altText（前後の空白を除いて 0〜500 字。写真は `width`・`height` が必須で 1〜2,048、動画は送らない） | `{ storyId }`（`key` は `^stories/<セッションの userId>/<UUIDv7>$`。他人の `stories/<他の id>/…` は FORBIDDEN、他の形・ファイルが無い・形式か大きさが合わないものは VALIDATION（「アップロードが完了していません」）。同じ `key` の 2 回目は 1 回目の `storyId` で、1 時間 30 件の数に入れない。動画の長さと画素は `video.mp4` の `mvhd`・`tkhd` から読み、15,000 ms を超えれば VALIDATION（「動画は 15 秒までです」）。`expires_at` = `created_at` + 24 時間） | UNAUTHENTICATED、FORBIDDEN、VALIDATION、RATE_LIMITED |
| `listStoryTray` | story | – | `StoryTrayView = { me: UserSummary, hasOwn: boolean, items: StoryTrayItem[] }`（`items` は 50 件まで）。`StoryTrayItem = { user: UserSummary, hasUnseen: boolean, latestAt: string }`（ISO 8601）。未読の人が先、同じなかでは新しいストーリーの人が先。自分は `items` に入れず `hasOwn` で返す。HTTP の入口と Server Action は無く、ホームのサーバーコンポーネントだけが呼ぶ | UNAUTHENTICATED |
| `getStoryReel` | story | `{ username }`（小文字にしてから引く） | `StoryReel = { user: UserSummary, isMe: boolean, stories: StoryItemView[], startIndex: number, nextUsername: string \| null }`（`stories` は期限内を古い順。`startIndex` は自分以外なら最初の未読、全て既読か自分なら 0。`nextUsername` は閲覧者のトレイ（`buildTray`）の並びで今の人より後ろにいて未視聴が残っている最初の人（全件視聴済みの人は飛ばす）、自分なら先頭から数えて未視聴が残っている最初の人、いなければ `null`。`StoryItemView` の `viewerCount` は自分のストーリーだけ数で、他人のは `null`。`storage_key` は返さず、`srcset`・`videoUrl` の URL だけを返す） | UNAUTHENTICATED、NOT_FOUND（利用者がいない、または期限内のストーリーが無い） |
| `markStoryViewed` | story | `{ storyId }`（UUID でなければ問い合わせずに NOT_FOUND） | `{ viewed: true }`（何度呼んでも同じ。他人のストーリーなら `story_views` に 1 行、自分のなら行を作らない） | UNAUTHENTICATED、NOT_FOUND（無い・期限切れ・UUID でない） |
| `listStoryViewers` | story | `{ storyId, cursor? }` | `Page<UserSummary>`（20 件、新しい閲覧順。投稿者だけ） | UNAUTHENTICATED、FORBIDDEN（投稿者ではない）、NOT_FOUND、VALIDATION（壊れたカーソル） |
| `listTagPosts` | hashtag | tag, cursor? | `Page<PostTile> & { name, postCount }`（12 件。タグは大文字小文字・全角半角を問わない。投稿が全て消えたタグは空の一覧） | UNAUTHENTICATED、NOT_FOUND、VALIDATION（壊れたカーソル） |
| `getPost` | post | postId | `PostView` | NOT_FOUND |
| `deletePost` | post | postId | `{ deleted: true }`（既に無い投稿には、ログインしていれば誰にでも同じ結果を返す。持ち主を確かめる対象が無いため） | UNAUTHENTICATED、FORBIDDEN、NOT_FOUND |
| `likePost` / `unlikePost` | like | postId | `{ liked, likeCount }`（何度呼んでも同じ結果） | UNAUTHENTICATED、NOT_FOUND |
| `savePost` / `unsavePost` | bookmark | postId | `{ saved }`（何度呼んでも同じ結果） | UNAUTHENTICATED、VALIDATION（余計な項目）、NOT_FOUND |
| `listSavedPosts` | bookmark | cursor?（本人の保存だけ。利用者を指定する項目は無い） | `Page<PostTile>`（12 件、保存した新しい順。カーソルの id は `post_id`） | UNAUTHENTICATED、VALIDATION（壊れたカーソル・余計な項目） |
| `listLikers` | like | postId, cursor? | `Page<UserSummary>`（20 件） | NOT_FOUND |
| `listReplies` | comment | commentId（親のコメントの ID）, cursor? | `Page<CommentView>`（20 件、古い順）。親でない・存在しないコメントは NOT_FOUND、壊れたカーソルは VALIDATION | NOT_FOUND、VALIDATION |
| `listComments` | comment | postId, cursor? | `Page<CommentView>`（親 20 件、返信は親ごとに最初の 3 件と件数） | NOT_FOUND |
| `addComment` | comment | postId, body（前後の空白を除いて 1〜2,200 字）, parentId?（同じ投稿のコメント。返信への返信は親の `parent_id` に付け替える）, clientRequestId | `CommentView`（同じ `clientRequestId` の 2 回目は 1 回目と同じ結果で、回数制限を消費しない） | UNAUTHENTICATED、VALIDATION、NOT_FOUND、RATE_LIMITED |
| `deleteComment` | comment | commentId | `{ deleted: true }`（親を消すと返信も消え、`comment_count` は消えた行の数だけ減る） | UNAUTHENTICATED、FORBIDDEN（本人でも投稿者でもない）、NOT_FOUND |
| `follow` / `unfollow` | follow | username | `{ following, followerCount }`（何度呼んでも同じ結果） | UNAUTHENTICATED、VALIDATION（自分自身）、NOT_FOUND |
| `listFollowers` / `listFollowing` | follow | username, cursor? | `Page<UserSummary>`（20 件） | NOT_FOUND |
| `listNotifications` | notification | cursor? | `Page<NotificationView>`（20 件、`created_at` の新しい順、同じ時刻は `id` の降順）。宛先はセッションの利用者だけで、入力に利用者の項目は無い（余計な項目は VALIDATION）。コメントは先頭 100 字と切ったかどうか | UNAUTHENTICATED、VALIDATION（壊れたカーソル・余計な項目） |
| `getUnreadNotificationCount` | notification | – | `{ count }`（`read_at IS NULL` の数。100 で頭打ち） | UNAUTHENTICATED |
| `streamNotifications` | notification | –（セッション） | `GET /api/notifications/stream`。`text/event-stream`。最初に `retry: 1000` と `event: unread` / `data: {"unreadCount":N}`、その後は変わったときだけ同じイベント、15 秒ごとに `: ping`、60 秒で終わる（[ADR-0050](../adr/0050-notifications-via-sse-with-d1-checks.md)） | UNAUTHENTICATED（401、JSON。イベントは流さない） |
| `markNotificationsRead` | notification | – | `{ readCount }`（自分宛ての未読を全て既読にした数。何度呼んでも同じ状態） | UNAUTHENTICATED |
| `getFeed` | feed | cursor? | `Page<PostView>`（12 件） | UNAUTHENTICATED |
| `searchUsers` | search | q（前後の空白を除いて 1〜30 字） | `{ items: UserSummary[] }`（20 件まで。ユーザー名の前方一致・部分一致・表示名の一致の順。カーソルは無い） | UNAUTHENTICATED、VALIDATION、RATE_LIMITED |
| `listExplorePosts` | explore | cursor? | `Page<PostTile>`（24 件。直近 7 日間・自分とフォロー中の人を除く・いいね数の多い順。窓の時刻はカーソルの `asOf` で固定） | UNAUTHENTICATED、VALIDATION（壊れたカーソル） |

M2 以降の処理は、その PBI が同じ形でこの表に足す。
