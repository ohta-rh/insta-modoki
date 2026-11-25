---
type: Guide
title: ローカル開発の手順（共有の compose スタックとスロット）
description: 共有のスタックの起動と、worktree ごとのスロット（バケット・.dev.vars・.wrangler/state）の準備・初期化・削除のしかた。ローカルで動かす前、並列の PBI を始める前に読む。
tags: [environment, docker, guide]
status: stable
---

# ローカル開発の手順

決定は [ADR-0037](../adr/0037-serve-local-media-from-garage-web-endpoint.md)、ルールは `.claude/rules/local-environment.md`。

# 共有のスタック（Director だけが行う）

main のチェックアウトで 1 回だけ起動する。サービスは S3 互換ストレージの Garage（`s3`）だけで、DB は D1（worktree の `.wrangler/state`）。

```
docker compose up -d --wait
docker compose ps --format '{{.Service}} {{.Health}}'   # s3 healthy
```

S3 API はホストの `http://localhost:3910`（署名付きの PUT・HEAD・DELETE）、画像の配信（匿名の GET）はウェブ用エンドポイントの `http://insta-s<N>.web.localhost:3912`（Chrome は `*.localhost` を 127.0.0.1 に解決する）。止める・作り直すのは Director だけで、worktree からは行わない。

# スロット

スロット `N` は 0〜4（0 は main のチェックアウト）。worktree の中で流す。

| コマンド | することと結果 |
|---|---|
| `node scripts/slot.mjs prepare <N>` | バケット `insta-s<N>` と鍵 `insta-local` を無ければ作り、バケットをウェブ公開にし、`.dev.vars` を書く。`migrations/` があれば D1 に流す。何回流しても、データと秘密の値は残る |
| `node scripts/slot.mjs reset <N>` | 先に `drop` と同じにスロットのポートのプロセスを止め、`.wrangler/state` を消し、バケットを 32 本並べて消し（1 万個ごとに消した数を出す）、Garage の後始末が捌けるのを待ってから（ADR-0063）、`prepare` と同じに整える |
| `node scripts/slot.mjs drop <N>` | 先にポート `3100 + N` で待ち受けるプロセスを子ごと止め（TERM、5 秒待って KILL。止まらなければ PID を出して 1 で終わり、消さない）、`slot N のポート 310N のプロセスを M 個止めました` と出す。そのあとバケットの中身を 32 本並べて消し（1 万個ごとに消した数を出す）、バケットを削除し、Garage の後始末が捌けるのを待ち（ADR-0063）、`.wrangler/state` を消す。`.dev.vars` は残す |
| `node scripts/slot.mjs status` | `Garage: MklTodo=<n> GcTodo=<n>` を出す（`garage stats` の `object` の行）。GcTodo が 1,000,000 を超えていれば、作り直しの案内を 1 行足す |

結合テストは、スロットのバケットに作ったファイルを最後に消して終わる（ADR-0060）。

終了コードは、成功 0、スタックが止まっている・コマンドの失敗 1、引数の誤り 2。

# `.dev.vars` の中身

`.env.example` に名前の一覧がある（値は空）。`SLOT`・`PORT`（`3100 + N`）・`BETTER_AUTH_URL`・`BETTER_AUTH_SECRET`・`AUTH_PEPPER`・`S3_ENDPOINT`・`S3_REGION`・`S3_BUCKET`・`S3_ACCESS_KEY`・`S3_SECRET_KEY`・`S3_PUBLIC_BASE_URL`・`MEDIA_ORIGIN`。`AUTH_PEPPER`・`BETTER_AUTH_SECRET` は初回に乱数で作り、以降は保つ。`.dev.vars` は git に入れない。

`INVITE_REQUIRED` は `.dev.vars` に書かない（未設定 = サインアップに招待コードは要らない。M1 の既定）。`true` にすると招待コードが必須になる。本番の値は配布の設定（#30）で入れる。

`prepare` と `reset` は、スロットのバケットの CORS（アプリの origin `http://localhost:<3100+N>` からの PUT・GET・HEAD）も設定する。ブラウザが署名付き URL へ直接 PUT するために要る。

# シードデータ（デモと計測用）

スロットの D1 とバケットに、決まった形のデータを入れる。スロットを準備した後（`node scripts/slot.mjs prepare <N>`）、worktree の中で流す。バケットがスロットのもの（`insta-s<N>`）でないとき、`APP_ENV=production` のときは何もせず 1 で終わる。

| コマンド | 作るもの |
|---|---|
| `pnpm seed:demo` | 利用者 30 人（`demo` を含む）、投稿 300 件、画像（1〜10 枚）、いいね・コメント・フォロー。最後の行は `seed: demo OK users=30 posts=300 media=<n>`。約 20 秒 |
| `pnpm seed:bench` | 利用者 1,000 人、投稿 10,000 件。画像は 60 枚を使い回す（このデータはアプリから消さない）。最後の行は `seed: bench OK users=1000 posts=10000`。約 1 分。API の計測の前に流す明示のコマンドで、`verify` の E2E では流さない |
| `node scripts/backfill-hashtags.ts` | スロットの D1 にある既存の投稿のキャプションから、タグ（`hashtags`・`post_hashtags`）を作る。何度流しても同じ。1 投稿は最初の 30 個まで、100 字を超えるタグは飛ばす。最後の行は `backfill-hashtags: OK posts=<n> links=<m>`（2 回目は `links=0`）。seed の後に流すと、デモの投稿のタグの一覧ができる |

* 同じ DB に何回流しても結果は同じ。メールが `@seed.invalid` で終わる利用者（とその投稿・画像）だけを消してから入れ直す。実在の利用者の行は消さない。
* `demo` のメールは `demo@seed.invalid`。パスワードは環境変数 `SEED_DEMO_PASSWORD` で渡す。渡さないと 16 字を作って 1 度だけ標準出力に出す（リポジトリには書かない）。
* 画像は図形から自分で作る（第三者の素材は使わない。[ADR-0003](../adr/0003-reproduce-ux-under-own-brand.md)）。乱数は固定の seed（20261121）。
* 終了コード: 成功 0、数が合わない・本番・失敗 1、引数の誤り 2。
* E2E は `e2e/support/demo.ts` の `ensureDemoSeed()` と `loginAsDemo(page)` を使う。

# PWA のアイコン

`node scripts/pwa-icons.mjs` は `public/brand/logo-mark.svg` を、入れてある Playwright の Chromium で `public/icons/` の 3 つの PNG（192・512・maskable 512）に描き直す。ロゴを変えたときだけ流し、できた PNG を commit する。

# 定期ジョブを手で動かす

スロットを準備した後（`node scripts/slot.mjs prepare <N>`）、worktree の中で流す。Worker の Cron Trigger（毎日 18:00 UTC）と同じコードが、スロットの D1 とバケットに対して動く（[ADR-0049](../adr/0049-scheduled-jobs-run-from-cron-trigger-in-a-custom-worker-entry.md)）。

| コマンド | 動き |
|---|---|
| `pnpm jobs:run story-cleanup` | 期限切れのストーリーの行とファイルを消す。標準出力は `story-cleanup: deleted=<件数>`（1 回に 1,000 件まで） |
| `pnpm jobs:run storage-orphans-retry` | 消せなかったファイル（`storage_orphans`）を再試行する。10 回で諦め、ログに出す |
| `pnpm start --test-scheduled` の後に `http://localhost:<3100+N>/__scheduled?cron=0+18+*+*+*` を開く | 全てのジョブを順に動かす（Cron Trigger と同じ経路）。結果はアプリのログに出る |

* 終了コード: 成功 0、ジョブの失敗 1、知らない名前・名前なし 2（標準エラーに登録済みの名前を出す）。
* アプリが書いている最中は SQLITE_BUSY で失敗しうる。そのときはもう一度流す。

# テスト

* `pnpm exec vitest run scripts/slot.test.ts` - スタック不要
* `SLOT_INT=1 pnpm exec vitest run scripts/slot.int.test.ts` - スタックが起動していること。`SLOT_INT=1` が無いと飛ばす（`verify` も同じ）。`SLOT_INT=1 PORT=3100 node scripts/verify.mjs` は main のチェックアウトと CI だけで流す。スロットを初期化・削除するので、他の worktree が使っていないスロットで流す（既定は 0 と 4。`SLOT_INT_A`・`SLOT_INT_B` で変える）

# うまくいかないとき

* 「共有のスタックが起動していません」 - Director に `docker compose up -d --wait` を頼む
* ホストの 3912 番が使われている - `compose.yaml` の `ports` と `SLOT_MEDIA_PORT`（スクリプト）を合わせて変える（Director の仕事）
* ホストの 3910 番が使われている - `compose.yaml` の `ports` と `SLOT_S3_ENDPOINT`（スクリプト）、`S3_ENDPOINT` を合わせて変える（Director の仕事）
* 「Garage が重い」（`reset` / `drop` が `Garage の後始末を待っています（MklTodo=<n>）` を出し続ける、verify の結合テストが時間切れで落ちる）- Garage は消したオブジェクトの後始末（Merkle の更新）を後で行い、その間 CPU を使う。`reset` と `drop` は MklTodo が 500 未満になるまで 30 秒ごとに待ち、30 分で諦めて 1 で終わる（ADR-0063）。`node scripts/slot.mjs status` で今の MklTodo と GcTodo を見る。他のスロットが大量に消している間も上がるので、下がるまで verify は流さない。GcTodo が 1,000,000 を超えて下がらないときは、Garage のボリュームの作り直し（`docker compose down -v`、全スロットのデータが消える）が要る。これは利用者だけが行う
