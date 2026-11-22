---
type: Architecture
title: データモデル
description: 全機能のテーブル・列・制約・インデックス・削除の連鎖。PBI の「実装方針 › データ」はこの文書の節を参照する。DB は D1（SQLite）に決まり（[ADR-0019](../adr/0019-d1-and-drizzle.md)）、型は「DB の型の対応」の表で写す。
tags: [architecture, data]
status: stable
---

# データモデル

企画書 05（情報設計・データモデル）を元にした決定。型は方言に依らない名前で書き（`text` / `integer` / `timestamp`（UTC）/ `boolean`）、下の「DB の型の対応」で D1 の型に写す。

## DB の型の対応

DB は D1（SQLite）。Drizzle ORM の列の定義は右の列（[overview.md](overview.md) の #23 の行）。

| この文書の型 | D1（SQLite）の型 | Drizzle ORM の列 | 備考 |
|---|---|---|---|
| `text` | `TEXT` | `text("<列>")` | UUIDv7 の `id` も文字列 |
| `integer` | `INTEGER` | `integer("<列>")` | 件数・画素・ミリ秒 |
| `timestamp`（UTC） | `INTEGER`（UTC のエポックのミリ秒） | `integer("<列>", { mode: "timestamp_ms" })` | コードでは `Date` |
| `boolean` | `INTEGER`（0 と 1） | `integer("<列>", { mode: "boolean" })` | `CHECK (<列> IN (0, 1))` を付ける |

## 共通の決まり

- 制約名は `<table>_<column>_check`（CHECK）・`<table>_<column>_unique`（UNIQUE。複数の列は `media_post_id_position_unique`）、索引名は `<table>_<列>_idx`。`migrations/0001_mvp_schema.sql` で作った名前は次のとおり（[ADR-0028](../adr/0028-first-migration-conventions-and-test-db.md)）。
  - CHECK: `users_username_check`（小文字・3〜30 字）・`users_email_check`（小文字）・`users_display_name_check`・`users_bio_check`・`users_role_check`・`users_is_private_check`・`posts_caption_check`・`posts_like_count_check`・`posts_comment_count_check`・`media_position_check`・`media_type_check`・`media_width_check`・`media_height_check`・`media_alt_text_check`・`comments_body_check`・`follows_follower_id_check`
  - UNIQUE: `users_username_unique`・`users_email_unique`・`media_post_id_position_unique`
  - 索引: `posts_author_id_created_at_id_idx`・`posts_created_at_id_idx`・`likes_post_id_created_at_idx`・`comments_post_parent_created_idx`・`follows_followee_created_idx`
- 「前後の空白を除いた長さ」の CHECK は、SQLite の `trim()` が既定では半角の空白しか除かないので、空白・タブ・改行・全角の空白などを明示して `trim(x, char(32, 9, 10, 11, 12, 13, 160, 12288))` と書く。文字数は `length()`（バイトでなく文字）。

- 主キー `id` は UUIDv7 の文字列（時系列順に並ぶ）。カーソルの並びのキーにも使う（[conventions.md](conventions.md) の「カーソル」）。
- 時刻は全て UTC の `timestamp`。列名は `created_at` / `updated_at` / `expires_at` / `read_at`。
- 外部キーは、利用者（`users`）と投稿（`posts`）からの削除を連鎖させる（`ON DELETE CASCADE`）。ストレージのファイルの削除は、行の削除と同じ処理の中で行う（[conventions.md](conventions.md) の「削除」）。
- 件数の非正規化は `posts.like_count` と `posts.comment_count` だけ。増減は行の追加・削除と同じトランザクションで行う。
- マイグレーションは PBI ごとに新しい手書きのファイル `migrations/NNNN_<name>.sql`（番号は Director が着手時に割り当てる）。`wrangler d1 migrations apply DB --local` で流す。
- 件数の増減と行の追加は同じ `db.batch([...])` に入れる（D1 は対話的なトランザクションに対応しない。[ADR-0019](../adr/0019-d1-and-drizzle.md)）。

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

`email_verified`（boolean、NOT NULL、既定値 false）は Better Auth の利用者モデルが要求する列（`migrations/0002_auth.sql` で足した）。パスワードのハッシュとセッションは Better Auth のテーブル（下）に置き、`users.id` を参照する（[ADR-0030](../adr/0030-better-auth-session-and-rate-limit-rules.md)）。

### sessions / accounts / verifications

`migrations/0002_auth.sql`。Better Auth のモデル名は複数形で、`users` の `name` は `display_name`、`image` は `avatar_key` に対応する。

| テーブル | 列 | 制約 |
|---|---|---|
| sessions | id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at | PK id、FK users ON DELETE CASCADE、UNIQUE token、索引 user_id。有効期間は 30 日 |
| accounts | id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at | PK id、FK users ON DELETE CASCADE、UNIQUE (provider_id, account_id)、索引 user_id。メールとパスワードは `provider_id = 'credential'`、`password` は `pbkdf2-sha256-hmac$…` |
| verifications | id, identifier, value, expires_at, created_at, updated_at | PK id、索引 identifier（M1 では使わない） |

### posts

| 列 | 型 | 制約 |
|---|---|---|
| id | text | PK |
| author_id | text | NOT NULL、FK users ON DELETE CASCADE |
| caption | text | NOT NULL、既定値 `''`、0〜2,200 字 |
| client_request_id | text | NULL 可（SQLite は既存の表に NOT NULL の列をそのまま足せないため。アプリは常に値を入れる）。UNIQUE `(author_id, client_request_id)`（再送の判定。NULL は重複を許す。[conventions.md](conventions.md) の「書き込みの再送」） |
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
| storage_key | text | NOT NULL、UNIQUE（同じ写真を 2 つの投稿が同時に使えない）。`media/<userId>/<UUIDv7>`。その下に `orig.webp`（長辺 2,048px）・`w320.webp`・`w640.webp`・`w1080.webp`（拡大はしない） |
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
| client_request_id | text | NULL 可（`posts` と同じ理由。`migrations/0006_comments_client_request_id.sql` で足した。アプリは常に値を入れる）。UNIQUE `(author_id, client_request_id)`（再送の判定。NULL は重複を許す。[conventions.md](conventions.md) の「書き込みの再送」） |
| created_at | timestamp | NOT NULL |

インデックス `(post_id, parent_id, created_at, id)`。`posts.comment_count` は返信も数える。コメントの行の追加・削除と同じ `db.batch` で増減し、親を消すときは、消える行（親と返信）の数を同じ文の中で数えて減らす（0 を下回らない）。

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

- **stories**（`migrations/0007_stories.sql`、#47）: `id`、`author_id`（FK users CASCADE）、`type`（`'image'` / `'video'`。`stories_type_check`）、`storage_key`（UNIQUE `stories_storage_key_unique`。`stories/<author_id>/<UUIDv7>`。再送の判定と、同じファイルの二重登録の防止。写真はその下に `orig.webp`・`w320.webp`・`w640.webp`・`w1080.webp`、動画は `video.mp4`）、`width`・`height`（1〜10,000。`stories_width_check` / `stories_height_check`）、`duration_ms`（写真は NULL、動画は 1〜15,000。`stories_duration_ms_check`。NULL の動画を通さないよう `IS NOT NULL` を明示する）、`alt_text`（既定 `''`、500 字以下。`stories_alt_text_check`）、`created_at`、`expires_at`（`created_at` + 86,400,000 ms ちょうど。`stories_expires_at_check`）。インデックス `stories_author_id_expires_at_idx (author_id, expires_at)`（トレイとビューア）、`stories_expires_at_idx (expires_at)`（#56 の削除。著者を問わない検索に前の索引は使えない）。`expires_at` を過ぎた行は取得時に除外し（`expires_at > now`。ちょうどの時刻は除外）、削除は #56。
- **story_views**（同上）: PK `(story_id, viewer_id)`（FK stories CASCADE、FK users CASCADE）、`created_at`。インデックス `story_views_story_id_created_at_idx (story_id, created_at DESC, viewer_id DESC)`（閲覧者一覧）、`story_views_viewer_id_idx (viewer_id)`（自分の既読）。
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
