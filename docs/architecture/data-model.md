---
type: Architecture
title: データモデル
description: 全機能のテーブル・列・制約・インデックス・削除の連鎖。PBI の「実装方針 › データ」はこの文書の節を参照する。DB の方言（D1 / PostgreSQL）は #18 で決まり、型はその方言に写す。
tags: [architecture, data]
status: stable
---

# データモデル

企画書 05（情報設計・データモデル）を元にした決定。型は方言に依らない名前で書き、#18 で決まる DB の型に写す（`text` / `integer` / `timestamp`（UTC）/ `boolean`）。

## 共通の決まり

- 主キー `id` は UUIDv7 の文字列（時系列順に並ぶ）。カーソルの並びのキーにも使う（[conventions.md](conventions.md) の「カーソル」）。
- 時刻は全て UTC の `timestamp`。列名は `created_at` / `updated_at` / `expires_at` / `read_at`。
- 外部キーは、利用者（`users`）と投稿（`posts`）からの削除を連鎖させる（`ON DELETE CASCADE`）。ストレージのファイルの削除は、行の削除と同じ処理の中で行う（[conventions.md](conventions.md) の「削除」）。
- 件数の非正規化は `posts.like_count` と `posts.comment_count` だけ。増減は行の追加・削除と同じトランザクションで行う。
- マイグレーションは PBI ごとに新しいファイル `migrations/NNNN_<name>.sql`（番号は Director が着手時に割り当てる）。

## M1（MVP）

### users

| 列 | 型 | 制約 |
|---|---|---|
| id | text | PK（UUIDv7） |
| username | text | NOT NULL、UNIQUE。3〜30 字、`^[a-z0-9._]+$`、先頭と末尾は `.` 以外、`..` を含まない。保存時に小文字にする。予約語（[routes.md](routes.md) の「予約したユーザー名」）は不可 |
| display_name | text | NOT NULL、1〜30 字（前後の空白を除いた長さ） |
| bio | text | NOT NULL、既定値 `''`、0〜150 字 |
| avatar_key | text | NULL 可。ストレージのキー |
| email | text | NOT NULL、UNIQUE。保存時に小文字にする |
| role | text | NOT NULL、既定値 `'user'`。`'user'` / `'admin'` |
| is_private | boolean | NOT NULL、既定値 false（M4 で使う） |
| created_at / updated_at | timestamp | NOT NULL |

パスワードのハッシュとセッションは、#18 で決める認証ライブラリのテーブルに置き、`users.id` を参照する。

### posts

| 列 | 型 | 制約 |
|---|---|---|
| id | text | PK |
| author_id | text | NOT NULL、FK users ON DELETE CASCADE |
| caption | text | NOT NULL、既定値 `''`、0〜2,200 字 |
| client_request_id | text | NOT NULL。UNIQUE `(author_id, client_request_id)`（再送の判定。[conventions.md](conventions.md) の「書き込みの再送」） |
| like_count | integer | NOT NULL、既定値 0、0 以上 |
| comment_count | integer | NOT NULL、既定値 0、0 以上 |
| created_at | timestamp | NOT NULL |

インデックス: `(author_id, created_at DESC, id DESC)`（プロフィールとフィード）、`(created_at DESC, id DESC)`。

### media

| 列 | 型 | 制約 |
|---|---|---|
| id | text | PK |
| post_id | text | NOT NULL、FK posts ON DELETE CASCADE |
| position | integer | NOT NULL、0〜9。UNIQUE (post_id, position) |
| type | text | NOT NULL。`'image'`（M4 で `'video'`） |
| storage_key | text | NOT NULL。`media/<userId>/<UUIDv7>`。その下に `orig.webp`（長辺 2,048px）・`w320.webp`・`w640.webp`・`w1080.webp`（拡大はしない） |
| width / height | integer | NOT NULL、1 以上（原本の縮小後の画素） |
| alt_text | text | NOT NULL、既定値 `''`、0〜500 字 |
| thumbhash | text | NOT NULL（base64） |

### likes

| 列 | 型 | 制約 |
|---|---|---|
| user_id | text | FK users ON DELETE CASCADE |
| post_id | text | FK posts ON DELETE CASCADE |
| created_at | timestamp | NOT NULL |

PK `(user_id, post_id)`。インデックス `(post_id, created_at DESC)`（いいねした人の一覧）。

### comments

| 列 | 型 | 制約 |
|---|---|---|
| id | text | PK |
| post_id | text | NOT NULL、FK posts ON DELETE CASCADE |
| author_id | text | NOT NULL、FK users ON DELETE CASCADE |
| parent_id | text | NULL 可、FK comments ON DELETE CASCADE。返信は 1 階層だけ: 返信への返信は、親の `parent_id` に付け替えて保存する |
| body | text | NOT NULL、1〜2,200 字（前後の空白を除いた長さ） |
| client_request_id | text | NOT NULL。UNIQUE `(author_id, client_request_id)` |
| created_at | timestamp | NOT NULL |

インデックス `(post_id, parent_id, created_at, id)`。

### follows

| 列 | 型 | 制約 |
|---|---|---|
| follower_id | text | FK users ON DELETE CASCADE |
| followee_id | text | FK users ON DELETE CASCADE |
| created_at | timestamp | NOT NULL |

PK `(follower_id, followee_id)`。CHECK `follower_id <> followee_id`。インデックス `(followee_id, created_at DESC)`。

### rate_limits

レート制限の記録（[conventions.md](conventions.md) の「レート制限」）。

| 列 | 型 | 制約 |
|---|---|---|
| key | text | 例 `login:ip:<ip>`、`post:user:<id>` |
| window_start | timestamp | 窓の始まり |
| count | integer | NOT NULL |

PK `(key, window_start)`。

### storage_orphans

行は消えたが、ストレージのファイルの削除に失敗したキー（[conventions.md](conventions.md) の「削除」）。

| 列 | 型 | 制約 |
|---|---|---|
| storage_key | text | PK |
| created_at | timestamp | NOT NULL |
| attempts | integer | NOT NULL、既定値 0 |

## M2

- **invites**: `code`（PK、英大文字と数字 10 字）、`created_by`（FK users）、`max_uses`（1〜100）、`used_count`、`expires_at`、`revoked_at`（NULL 可）、`created_at`。
- **admin_actions**: `id`、`admin_id`（FK users）、`action`（`'delete_post'` / `'delete_user'` / `'resolve_report'`）、`target_id`、`created_at`。対象を消しても記録は残す（FK を張らない）。

## M3

- **stories**: `id`、`author_id`（FK users CASCADE）、`type`（`'image'` / `'video'`）、`storage_key`、`width`、`height`、`duration_ms`（動画のみ、15,000 以下）、`alt_text`、`created_at`、`expires_at`（`created_at` + 24 時間）。インデックス `(author_id, expires_at)`。
- **story_views**: PK `(story_id, viewer_id)`、`created_at`。
- **hashtags**: `id`、`name`（UNIQUE。NFKC で正規化し小文字にしたもの、1〜100 字）。**post_hashtags**: PK `(post_id, hashtag_id)`、`created_at`（投稿の時刻を写す）。
- **notifications**: `id`、`recipient_id`（FK users CASCADE）、`actor_id`（FK users CASCADE）、`type`（`'like'` / `'comment'` / `'follow'`）、`post_id`（NULL 可、FK posts CASCADE）、`comment_id`（NULL 可、FK comments CASCADE）、`read_at`（NULL 可）、`created_at`。インデックス `(recipient_id, created_at DESC)`。同じ actor・type・post のいいねは 1 件にまとめる（UNIQUE `(recipient_id, actor_id, type, post_id)` を like にだけ適用）。
- **bookmarks**: PK `(user_id, post_id)`、`created_at`。インデックス `(user_id, created_at DESC)`。

## M4

- **conversations**: `id`、`created_at`、`last_message_at`。**conversation_members**: PK `(conversation_id, user_id)`、`last_read_at`（NULL 可）。1 対 1 の会話は 2 人の組で一意（作成時に既存を探す）。
- **messages**: `id`、`conversation_id`（FK CASCADE）、`sender_id`（FK users CASCADE）、`kind`（`'text'` / `'image'` / `'post'` / `'story_reply'`）、`body`（0〜1,000 字）、`media_key`（NULL 可）、`post_id`（NULL 可、FK posts SET NULL）、`story_id`（NULL 可）、`created_at`。
- **blocks**: PK `(blocker_id, blocked_id)`、`created_at`。CHECK 別人。
- **reports**: `id`、`reporter_id`、`post_id`（FK CASCADE）、`reason`（`'spam'` / `'inappropriate'` / `'copyright'` / `'other'`）、`status`（`'open'` / `'removed'` / `'dismissed'`）、`created_at`、`resolved_at`。UNIQUE `(reporter_id, post_id)`。
- **follow_requests**: PK `(requester_id, target_id)`、`created_at`。
- **push_subscriptions**: `id`、`user_id`（FK CASCADE）、`endpoint`（UNIQUE）、`p256dh`、`auth`、`created_at`。
- 動画（任意）: `media.type = 'video'`、`media.duration_ms`（60,000 以下）を追加する。
