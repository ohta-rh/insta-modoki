---
type: ADR
title: "ADR-0023: compose のサービスは Garage だけにし、スロットは D1 のファイル・バケット・.dev.vars で分ける"
description: "共有の compose スタックは Garage v2.5.0 だけを置く。DB は D1 で worktree の .wrangler/state のファイル。スロットは scripts/slot.mjs が .dev.vars・バケット insta-s<N>・.wrangler/state を準備・初期化・削除する。ADR-0008 の DB の名前の規則を置き換える。"
tags: [environment, parallel, docker, storage]
status: deprecated
superseded_by: 0037-serve-local-media-from-garage-web-endpoint.md
---

# ADR-0023: compose のサービスは Garage だけにし、スロットは D1 のファイル・バケット・.dev.vars で分ける

- ステータス: 置き換え: [ADR-0037](0037-serve-local-media-from-garage-web-endpoint.md)（ローカルの画像をウェブ用エンドポイントから配信する。他の決定は引き継ぐ）
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0008](0008-share-one-compose-stack-with-a-slot-per-worktree.md)（これで置き換える）、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0021](0021-browser-made-webp-and-presigned-put.md)、#20

## 背景

[ADR-0008](0008-share-one-compose-stack-with-a-slot-per-worktree.md) は、DB のサーバー（`insta_s<N>`・`insta_s<N>_test`）と S3 互換のストレージを共有のスタックに置く前提だった。その後の [ADR-0019](0019-d1-and-drizzle.md) で DB が D1 になり、ローカルでは wrangler が worktree の `.wrangler/state` のファイルに持つ。結合テストは `getPlatformProxy({ persist: false })` のメモリ上の D1 を使う。DB のサーバーは要らず、worktree のファイルは worktree ごとに分かれている。残るのは S3 互換のストレージで、[ADR-0021](0021-browser-made-webp-and-presigned-put.md) が Garage v2.5.0（`s3_region = "auto"`）を選んでいる。

Garage の `dxflrs/garage:v2.5.0` は `/garage` の実行ファイルだけの image で、`/garage status` が健康確認に使える。`/garage key` と `/garage bucket` でバケットと鍵を作れ、`bucket delete` は空のバケットにしか効かない。ACL とポリシーは未対応（調査: [stack-selection.md](../research/stack-selection.md)）。確認日 2026-11-21、開発機の 3900 番のポートは別の Garage が使っていた。

## 決定

- `compose.yaml` のサービスは `s3`（`dxflrs/garage:v2.5.0`、`--single-node`）だけにする。DB のサービスは置かない。プロジェクト名は `name: insta-modoki`。設定は `configs.content` に埋め込み、worktree のパスに依存させない。ボリュームは `s3-meta` と `s3-data`。
- S3 API はホストの `127.0.0.1:3910` に出す（コンテナの中は 3900）。3900 を使わないのは、開発機で別の Garage が使いがちなため。RPC・管理 API のポートは出さない。
- スロットの名前は次のとおり。DB の名前（`insta_s<N>`・`insta_s<N>_test`）は使わない。
  - アプリのポート `3100 + N`（main は 3100）。ADR-0008 の `3000 + N` は使わない。この開発機で 3000 と 3001 が別のプロジェクトに使われているため（Director の決定）
  - バケット `insta-s<N>`
  - DB は worktree の `.wrangler/state`（D1 のファイル）。結合テストはメモリ上の D1 で、名前は要らない
  - 設定は worktree の `.dev.vars`（wrangler が読む。`.env.local` は使わない。git に入れない）
- `scripts/slot.mjs <prepare|reset|drop> <N>`（N は 0〜4）が、依存なしの Node.js で次を行う。終了コードは成功 0、スタック停止・コマンドの失敗 1、引数の誤り 2。
  - `prepare`: 鍵 `insta-local`（1 つ）とバケットを無ければ作り、鍵に読み・書き・所有を許可し、`.dev.vars` を書く。`AUTH_PEPPER` と `BETTER_AUTH_SECRET` は無ければ乱数で作り、あれば保つ。`migrations/` があれば `pnpm exec wrangler d1 migrations apply DB --local` を流す。何回流しても、データは消えない。
  - `reset`: `.wrangler/state` を消し、バケットのオブジェクトを全て消してから、`prepare` と同じに整える。
  - `drop`: バケットを空にして削除し、`.wrangler/state` を消す。`.dev.vars` は残す。
- スクリプトは `docker ps` のラベル（プロジェクト `insta-modoki`、サービス `s3`、`healthy`）でコンテナを探し、`docker exec` で `/garage` を呼ぶ。見つからなければ「共有のスタックが起動していません」と出して 1 で終わる。オブジェクトの削除は、SigV4 で署名した S3 API を Node.js の `fetch` で呼ぶ。
- 共有のスタックを `down`・`restart` するのは Director だけ。スクリプトは行わない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Garage だけを置く（採用） | ADR-0021 と同じ。DB のサービスが要らず、起動が軽い。image が小さい | 非対応の機能がある（ACL・ポリシー）。バケットを空にするには S3 API を呼ぶ必要がある |
| MinIO | 使い慣れている。管理用のコマンドが豊富 | リポジトリが 2026-04-25 にアーカイブされ、版が上がらない（ADR-0021） |
| PostgreSQL も置く | ADR-0008 のままで済む | D1 を使うので使われない。本番と違う SQL の方言になる |
| ホストのポート 3900 のまま | issue の文面どおり | 開発機で別の Garage と衝突して起動に失敗する（確認日 2026-11-21） |
| `.env.local` を使う | ADR-0008 のとおり | wrangler が読まず、`getPlatformProxy` に渡せない。`.dev.vars` なら同じ値を読める |
| バケットの削除に `aws` CLI を使う | 実装が短い | 開発機に別のツールが要る。依存なしの Node.js で足りる |

## 結果

- 4 つの PBI が同時に動いても、D1 のファイルは worktree ごとに、バケットはスロットごとに分かれる。
- ホストのポート 3910 と鍵 `insta-local` は共有で、スロットを超えて同じ。バケットの名前でデータを分ける。ストレージの認証は分かれない。
- ADR-0008 は置き換える。共有のスタックを 1 つにすること、ポートとバケットの名前の規則、Director だけがスタックを動かすこと、`compose.yaml` を変える PBI を単独の Wave にすることは引き継ぐ。DB の名前と `.env.local` は引き継がない。
- `compose.yaml` の config や image の版を変えたら、Director が共有のスタックに反映する。
- スロットのスクリプトのテストは Vitest で書く（[ADR-0022](0022-testing-ui-and-package-management.md)）。`scripts/slot.test.ts` は単体、`scripts/slot.int.test.ts` は結合で、`verify` の `integration` が `src/` と `scripts/` の `*.int.test.ts` から見つけて流す。
- 結合テスト（`scripts/slot.int.test.ts`）は `SLOT_INT=1` のときだけ流す（無いときは「skipped」の 1 行を出して飛ばす）。スロット 0 と 4 のバケットを空にするので、2 つの worktree の `verify` が同時に流すと互いを壊すため。main のチェックアウトと CI だけが `SLOT_INT=1` を付ける。また、他の worktree が使っていないスロット（既定は 0 と 4）で流す。`SLOT_INT_A` と `SLOT_INT_B` で変える。
