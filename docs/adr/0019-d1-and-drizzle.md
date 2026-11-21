---
type: ADR
title: "ADR-0019: DB は Cloudflare D1、ORM は Drizzle ORM にする"
description: "DB は D1（ローカルは wrangler のファイル）、ORM は Drizzle ORM の安定版 0.45.4。PostgreSQL + Hyperdrive、Prisma、Kysely は退ける。トランザクションは db.batch() で行い、マイグレーションは手書きの SQL にする。"
tags: [architecture, database, orm]
status: stable
---

# ADR-0019: DB は Cloudflare D1、ORM は Drizzle ORM にする

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [調査](../research/stack-selection.md)、#18、[ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0008](0008-share-one-compose-stack-with-a-slot-per-worktree.md)、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0018](0018-nextjs-on-workers-via-opennext.md)

## 背景

ADR-0011 は DB を D1 にするか PostgreSQL + Hyperdrive にするかを #18 に残した。無料枠は、D1 が 1 DB 500 MB・読み 5,000,000 行と書き 100,000 行（1 日）、Hyperdrive が 1 日 100,000 クエリで、PostgreSQL 本体は Cloudflare の外に要る。D1 は対話的なトランザクションに対応せず、`batch()` が 1 つのトランザクションになる。試作で、D1 + Drizzle が workerd で動き、`db.batch()` が途中の失敗で全体を戻し、`db.transaction()` は `Failed query: begin` で失敗することを確かめた。

## 決定

- DB は D1 にする。ローカルは `wrangler` が `.wrangler/state` に持つファイルで、worktree ごとに独立し、compose に DB のサービスは置かない。
- ORM は Drizzle ORM の安定版（`latest` タグ）0.45.4 にする。v1 は RC なので使わない。
- 複数の書き込みを 1 つにまとめるときは `db.batch([...])` を使い、`db.transaction()` は使わない。`like_count` のような件数は、`UPDATE posts SET like_count = (SELECT count(*) FROM likes WHERE post_id = ?)` のように、同じ `batch` の中で再計算して何度呼んでも同じ結果にする。
- DB の型の対応は `text` → `TEXT`、`integer` → `INTEGER`、`timestamp` → `INTEGER`（UTC のエポックのミリ秒、Drizzle の `integer({ mode: "timestamp_ms" })`）、`boolean` → `INTEGER`（0 と 1、`integer({ mode: "boolean" })`）。
- マイグレーションは `migrations/NNNN_<name>.sql` の手書きの SQL にし、`wrangler d1 migrations apply DB --local` で流す。Drizzle のスキーマ（`src/features/<slice>/db/schema.ts`）は同じ変更で手で合わせ、一致は結合テストで確かめる。drizzle-kit の `generate` は、並列の PBI で番号が衝突するので使わない。
- 結合テストは `getPlatformProxy({ persist: false })` のメモリ上の D1 に、マイグレーションを流して使う。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| D1 + Drizzle ORM 0.45.4（採用） | Cloudflare の中で完結し、外部のアカウントが要らない。ローカルは compose の DB が要らない。試作で動いた | 対話的なトランザクションが無い。1 回の呼び出しは 50 クエリまで。1 日の書き込み 100,000 行（索引の更新も数える） |
| PostgreSQL + Hyperdrive | トランザクションと PostgreSQL の機能が使える | PostgreSQL が Cloudflare の外に要り、別のアカウントと無料枠の確認が要る。ローカルは compose の DB とスロットごとの DB が要る。ローカルでは接続プールが効かない |
| Prisma（D1 のアダプター） | 型の生成と文書が厚い | D1 への対応は Preview で、トランザクションが個別のクエリになる（ACID にならない）。版が RC |
| Kysely | 型付きのクエリビルダー | D1 の dialect はコミュニティの kysely-d1 で、最新版が 2025-04-19 |
| Drizzle の v1 RC | 文書が `@rc` を勧める | 安定版ではない |

## 結果

- [data-model.md](../architecture/data-model.md) に、方言ごとの型の対応表を足した。
- `.claude/rules/local-environment.md` のスロットの「Database `insta_s<N>`」は、ローカルの D1 には当てはまらない。D1 のファイルは worktree の中で独立し、リセットは `.wrangler/state` の削除になる。#20 でこの規則を直す。
- `conventions.md` の「トランザクション」は `db.batch` として読む。件数の増減と行の追加は同じ `batch` に入れる。
- 無料枠の 1 日の書き込み 100,000 行を超える使い方（たくさんのいいねなど）は、M2 の公開の前に見積もる。
