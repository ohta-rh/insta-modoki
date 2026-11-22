---
type: Architecture
title: 実装の共通の決まり
description: slice の中の構成、テストの置き場所と名前、エラーの形と文言、カーソル、上限とレート制限、削除、画面に返す形。PBI の実装方針と検証はこの決まりを前提に書く。
tags: [architecture, conventions]
status: stable
---

# 実装の共通の決まり

言語と UI は TypeScript と React（[ADR-0016](../adr/0016-typescript-and-react.md)）。フレームワーク・DB・ORM・認証は [overview.md](overview.md)（#18）で決まった。

## slice の中の構成（[ADR-0014](../adr/0014-code-in-feature-slices.md)）

```
src/features/<slice>/
  index.ts            # 外に見せる入口（他の slice はここだけを import する）
  api/<name>.ts       # サーバーの処理 1 つ（routes.md の処理名）
  model/schema.ts     # 入力の Zod スキーマと型
  model/*.ts          # 純粋なロジック
  db/                 # その slice のテーブルの定義と問い合わせ（スキーマの入口には 1 行で登録する）
  ui/<Component>.tsx  # React の部品
src/shared/
  db/                 # 接続、スキーマの入口、トランザクション
  storage/            # S3 互換のストレージ（ローカル）と R2（本番）
  ui/                 # トークン・アイコン・ナビ・共通の部品
  security/           # ヘッダー・CSP・レート制限
  errors.ts           # AppError と変換
```

## テスト

| 種類 | 置き場所 | 名前 | 実行 |
|---|---|---|---|
| 単体 | `src/**/<file>.test.ts(x)`、`scripts/**/*.test.ts` | `describe('<対象>')` / `it('<条件> のとき <結果>')`（日本語） | verify の単体テスト |
| 結合（DB・ストレージを使う） | `src/**/<file>.int.test.ts` | 同上 | スロットのテスト用 DB（`.claude/rules/local-environment.md`） |
| E2E | `e2e/<feature>.spec.ts` | `test('<利用者の操作> と <結果>')` | Playwright、スロットのポート |

PBI の「検証」は、このファイル名と名前で書く。

カバレッジは単体テストで測り、対象は `src/**/model/**` と `src/shared/config/**`、基準は行 80%（下回ると verify の `unit` が失敗する）。verify の手順は [verify.md](../guides/verify.md)（[ADR-0024](../adr/0024-verify-command-and-coverage-gate.md)）。

## エラー

サーバーの処理は、失敗を `AppError { code, message, fieldErrors?, retryAfterSec? }` で返す。`message` は画面にそのまま出す日本語。

| code | HTTP | 既定の文言 |
|---|---|---|
| `UNAUTHENTICATED` | 401 | ログインしてください（ログインの失敗は「メールアドレスまたはパスワードが違います」） |
| `FORBIDDEN` | 403 | この操作はできません |
| `NOT_FOUND` | 404 | ページが見つかりません |
| `VALIDATION` | 422 | 入力を確認してください（`fieldErrors` に項目ごとの文言） |
| `CONFLICT` | 409 | このユーザー名は使われています / このメールアドレスは登録済みです |
| `RATE_LIMITED` | 429 | 操作が多すぎます。しばらくしてからもう一度お試しください（`retryAfterSec`） |
| `PAYLOAD_TOO_LARGE` | 413 | ファイルが大きすぎます（1 枚 10MB まで） |

内部の例外の内容（SQL・スタック・ファイルのパス）は画面にも応答にも出さない。`toErrorResponse(error)`（`src/shared/errors.ts`）が、`AppError` は code に対応する HTTP 状態で返し、それ以外の例外は 500 と固定の文言「エラーが発生しました。しばらくしてからもう一度お試しください」にする。

`signUp` と `checkUsername` の項目ごとの文言（`fieldErrors`）。

| 項目 | 文言 |
|---|---|
| email | メールアドレスの形式を確認してください |
| username | ユーザー名は 3〜30 字で入力してください / ユーザー名は英小文字・数字・.・_ だけ使えます（先頭と末尾は . 以外、.. は不可） / このユーザー名は使えません（予約語） / このユーザー名は使われています（CONFLICT） |
| email（CONFLICT） | このメールアドレスは登録済みです |
| displayName | 表示名は 1〜30 字で入力してください |
| password | パスワードは 8〜72 字で入力してください（バイトの上限は無い） |

## 入力の検証

- 文字数は Unicode のコードポイントで数える（`src/shared/text.ts` の `charLength`）。メールアドレスとユーザー名は、保存の前にアプリの側で `toLowerCase()`（Unicode）し、NUL と制御文字を拒む（SQLite の `lower()` は ASCII だけ、`length()` は NUL で止まるため。`hasControlChars`）。上限のある文字の項目は、前後の空白を除いてから数える。
- VALIDATION の `fieldErrors` には、項目ごとに「<項目名>は N 文字以内で入力してください」「<項目名>を入力してください」の形の文言を入れる。

## 認証とセッション

- セッションの有効期限は 30 日。他の slice は `src/features/auth` の `getSessionUser()`（いなければ null）と `requireUser()`（いなければ UNAUTHENTICATED）だけを使い、認証ライブラリを直接呼ばない。
- 利用者の IP は `cf-connecting-ip` のヘッダーから取り、無ければ `local` とする（`src/shared/security/client-ip.ts`）。
- ログインが要る全てのサーバーの処理（Server Action・Route Handler）と、`(app)` の下の全てのデータの読み出しは、最初に `requireUser()`（または `getSessionUser()` と明示の判定）を呼ぶ。`(app)` のレイアウトの転送だけに頼らない。Next.js はページを切り替えるときにレイアウトを実行し直さず、Server Action はレイアウトを通らずに呼べるため（#26 のセキュリティレビュー。ADR-0031）。例外は `logIn`・`signUp`・`checkUsername`（ログインしていない人が呼ぶ）と `logOut`（セッションが無くても成功する必要がある。#31）だけ。
- 回数制限のテストは、全ての呼び出しに固定の `now` を渡す。本物の時計を使うと、固定の窓の切れ目をまたいで回数が戻り、CI でだけ落ちる（2026-11-21 の CI の赤。#26）。

## 画像の処理

画像の縮小と変換はブラウザだけで行う。canvas で WebP（品質 0.82）に描き直し、長辺 2,048px の原本と 320 / 640 / 1,080px の幅を作る。元より大きくはしない。EXIF は描き直しで消える。

## ハイドレーション

最初のキー入力やクリックで動かなければならない操作（送信・遷移・ファイル選択・ダイアログを開く）は、ブラウザ自身の動作で作る（form、リンク、input、dialog と popover の呼び出し属性 `commandfor` / `command`）。JS だけで動く操作（カルーセルの矢印キー、スクロール位置の追跡など）は、JS の読み込み後に効けばよい強化として作る。ルートのレイアウトの `HydrationMarker`（`src/shared/ui/`）が、ハイドレーションの後に `html[data-hydrated="1"]` を付ける。E2E は JS だけで動く操作に触る前に `e2e/support/hydration.ts` の `waitForHydration(page)` を呼ぶ。JS の読み込みを止めた状態で操作できることは、`e2e/media-upload.spec.ts` と `e2e/post-detail.spec.ts` の「JS が読み込まれる前でも」の形のテストで確かめる。`<input type="file">` の選択を React の `onChange` で取り込むときは、ハイドレーションの前に選ばれたファイルも `useFilesPickedBeforeHydration`（`src/shared/ui/`）でマウント時に取り込む（ADR-0054）。

## カーソル

- 並びは既定で `(created_at DESC, id DESC)`。コメントと返信の一覧は古い順（`created_at ASC, id ASC`）。フォロワー・フォロー中・いいねした人の一覧は、`id` の位置に相手の利用者の id を入れる。タグの投稿の一覧は `post_hashtags.created_at` の新しい順で、`id` の位置に `post_id` を入れる。カーソルは最後の行の `created_at` と `id` を `|` でつないで base64url にした文字列。OFFSET は使わない。発見の一覧だけは `asOf|like_count|created_at|id`（`asOf` は 1 ページ目を読んだ時刻の epoch ミリ秒。7 日の窓を全ページで同じ時刻から数える）で、並びは `like_count DESC, created_at DESC, id DESC`。`asOf` が現在より未来のカーソルは VALIDATION。
- 応答は `Page<T> = { items: T[], nextCursor: string | null }`。壊れたカーソルは VALIDATION。

## 画面に返す形

- `UserSummary = { username, displayName, avatarUrl | null }`
- `ProfileView = UserSummary & { bio, postCount, followerCount, followingCount, isMe, isFollowing }`
- `MediaView = { type, width, height, altText, thumbhash, srcset: { w320, w640, w1080 } }`
- `PostView = { id, author: UserSummary, caption, media: MediaView[], likeCount, commentCount, likedByMe, createdAt }`
- `PostThumb = { id, cover: MediaView, mediaCount }`
- `PostTile = { id, cover: MediaView, mediaCount, username }`（`PostThumb` に投稿者の `username` を足した形。いろいろな人の投稿が並ぶグリッド `PostTileGrid` の `alt` に使う）
- `CommentView = { id, author: UserSummary, body, parentId | null, createdAt, canDelete, replies?: CommentView[], replyCount? }`

`email`・`role`・パスワード・ストレージのキーは、どの形にも入れない。

## 上限とレート制限

| 対象 | 上限 |
|---|---|
| 画像 | 1 枚 10MB、1 投稿 10 枚、JPEG / PNG / WebP / HEIC、長辺 2,048px に縮小 |
| 文字 | キャプション 2,200 字、コメント 2,200 字、自己紹介 150 字、表示名 30 字、代替テキスト 500 字、ハッシュタグ 1 投稿あたり 30 個・1 個 100 字（NFKC で正規化した後のコードポイント） |
| ログインの試行 | 同じ IP から 1 分あたり 5 回、同じメールの失敗は 1 時間あたり 10 回（`consume('login:email:<小文字にしたメール>', 10, 3600)`）。IP は `cf-connecting-ip` だけから取り（`X-Forwarded-For` は使わない。ローカルは `local`）。Better Auth の組み込みのメモリ上の制限は使わず、`consume()` で行う（[ADR-0020](../adr/0020-better-auth-with-pbkdf2.md)） |
| サインアップ | 同じ IP から 1 時間あたり 10 回 |
| ユーザー名の空き確認（`checkUsername`） | 同じ IP から 1 分あたり 30 回（`consume('checkname:ip:<ip>', 30, 60)`） |
| 投稿 | 1 ユーザー 1 時間あたり 30 件 |
| コメント | 1 ユーザー 1 時間あたり 120 件 |
| アップロード URL の発行 | 1 ユーザー 1 時間あたり 300 枚（写真の投稿とストーリーで同じ枠 `upload:user:<id>`） |
| ユーザー検索 | 1 ユーザー 1 分あたり 60 回（`search:user:<id>`）。サーバーで描く `?q=` のページも同じ処理を通るので同じ数に入る |
| ストーリー | 1 ユーザー 1 時間あたり 30 件（`story:user:<id>`）。動画は 1 本 30MB・15 秒・MP4 だけ。24 時間で見えなくなる |

レート制限は固定の窓で数え、`src/shared/security/rate-limit.ts` の `consume(key, limit, windowSec, cost = 1, deps?)` で行い（1 回の upsert。`deps` は `{ db, now }` でテストが差し替える。窓の始まりは `now` を `windowSec` で切り捨てたミリ秒）、`rate_limits` テーブルに記録する（[data-model.md](data-model.md)）。

## D1 の 1 つの文の上限

D1 は 1 つの SQL の文に渡せるバインド変数が 100 個まで。複数行の INSERT（`values([...])`）は、列の数 × 行の数が 100 を超えないように分けるか、1 行 1 文にして同じ `db.batch` に入れる。超えると `D1_ERROR: too many SQL variables` で失敗する（#34 の E2E の準備で、7 列 × 50 行の INSERT が 500 になった）。

## 書き込みの再送

`createPost` と `addComment` は `clientRequestId`（UUID）を受け取り、同じ利用者の同じ値の 2 回目は 1 回目と同じ結果を返す（新しい行を作らない）。いいねとフォローは「状態にする」処理なので、何度呼んでも同じ結果になる。

## 削除

アップロードされたが行から参照されないオブジェクト（投稿せずに離脱した、`HEAD` の検査で拒否した）は、M3 の掃除のジョブが `media/<userId>/` の下で作成から 24 時間を過ぎ、`media`・`users.avatar_key` に無いものを消す（[ADR-0021](../adr/0021-browser-made-webp-and-presigned-put.md)）。

投稿・利用者の削除は、DB の行を消すトランザクションが成功した後に、ストレージのキーをまとめて消す。ファイルの削除に失敗しても行は戻さず、`storage_orphans`（M3 の掃除のジョブで再試行）に記録する。再試行は `storage-orphans-retry`（1 日 1 回、10 回まで。[ADR-0049](../adr/0049-scheduled-jobs-run-from-cron-trigger-in-a-custom-worker-entry.md)）が行う。期限切れのストーリーは `story-cleanup` が行とファイルを消す。
