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
| `node scripts/slot.mjs reset <N>` | `.wrangler/state` を消し、バケットを空にして、`prepare` と同じに整える |
| `node scripts/slot.mjs drop <N>` | バケットを削除し、`.wrangler/state` を消す。`.dev.vars` は残す |

終了コードは、成功 0、スタックが止まっている・コマンドの失敗 1、引数の誤り 2。

# `.dev.vars` の中身

`.env.example` に名前の一覧がある（値は空）。`SLOT`・`PORT`（`3100 + N`）・`BETTER_AUTH_URL`・`BETTER_AUTH_SECRET`・`AUTH_PEPPER`・`S3_ENDPOINT`・`S3_REGION`・`S3_BUCKET`・`S3_ACCESS_KEY`・`S3_SECRET_KEY`・`S3_PUBLIC_BASE_URL`・`MEDIA_ORIGIN`。`AUTH_PEPPER`・`BETTER_AUTH_SECRET` は初回に乱数で作り、以降は保つ。`.dev.vars` は git に入れない。

`prepare` と `reset` は、スロットのバケットの CORS（アプリの origin `http://localhost:<3100+N>` からの PUT・GET・HEAD）も設定する。ブラウザが署名付き URL へ直接 PUT するために要る。

# テスト

* `pnpm exec vitest run scripts/slot.test.ts` - スタック不要
* `SLOT_INT=1 pnpm exec vitest run scripts/slot.int.test.ts` - スタックが起動していること。`SLOT_INT=1` が無いと飛ばす（`verify` も同じ）。`SLOT_INT=1 PORT=3100 node scripts/verify.mjs` は main のチェックアウトと CI だけで流す。スロットを初期化・削除するので、他の worktree が使っていないスロットで流す（既定は 0 と 4。`SLOT_INT_A`・`SLOT_INT_B` で変える）

# うまくいかないとき

* 「共有のスタックが起動していません」 - Director に `docker compose up -d --wait` を頼む
* ホストの 3912 番が使われている - `compose.yaml` の `ports` と `SLOT_MEDIA_PORT`（スクリプト）を合わせて変える（Director の仕事）
* ホストの 3910 番が使われている - `compose.yaml` の `ports` と `SLOT_S3_ENDPOINT`（スクリプト）、`S3_ENDPOINT` を合わせて変える（Director の仕事）
