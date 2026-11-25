---
type: ADR
title: "ADR-0028: 最初のマイグレーションは制約名と空白の扱いを固定し、DB の結合テストは D1 のメモリで流して `_test` の名前にしか繋がない"
description: "CHECK と UNIQUE と索引の名前の付け方、前後の空白を除く CHECK の書き方、username と email を DB で小文字に縛ること、withTransaction を作らないこと、結合テストの土台 useTestDb の作りと接続先の安全装置を決める。"
tags: [architecture, database, testing]
status: stable
---

# ADR-0028: 最初のマイグレーションは制約名と空白の扱いを固定し、DB の結合テストは D1 のメモリで流して `_test` の名前にしか繋がない

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #23、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0022](0022-testing-ui-and-package-management.md)、[data-model.md](../architecture/data-model.md)

## 背景

#23 は 6 つのコアテーブルを 1 つの手書きマイグレーションで作り、以後の PBI がその名前と書き方を真似る。D1（SQLite）の `trim(x)` は半角の空白しか除かず、`length()` は文字数を数える。D1 は `db.transaction()` が使えない（ADR-0019）。結合テストは `getPlatformProxy({ persist: false })` のメモリの D1 で流す（ADR-0022）。

## 決定

- 名前: CHECK は `<table>_<column>_check`、UNIQUE は `<table>_<column(s)>_unique`、索引は `<table>_<列>_idx`。1 つの列に複数の条件があるときは 1 つの CHECK に `AND` でまとめる（`users_username_check` は小文字と 3〜30 字）。
- 前後の空白を除く長さは `length(trim(x, char(32, 9, 10, 11, 12, 13, 160, 12288)))` と書く。
- `users.username` と `users.email` は DB でも `x = lower(x)` を CHECK し、形（`^[a-z0-9._]+$` など）と予約語は入力の検証（#26）に任せる。
- `withTransaction` は作らない。複数の書き込みは `db.batch([...])`。
- 結合テストの土台 `tests/helpers/db.ts` の `useTestDb()` は、ファイルごとに 1 度、メモリの D1 に `migrations/*.sql` を（`d1_migrations` に記録しながら）1 度ずつ当て、各テストの前に 6 つのテーブルを空にする。`TEST_DATABASE_URL` があるときは DB 名が `_test` か `_test_<数字>` で終わらなければ「テスト用ではない DB には接続しません: <名前>」で投げる（将来外部の DB に繋ぐ変更が入っても、本物の行を消さないための安全装置）。
- `newId()` の同じミリ秒の単調増加は、1 つの isolate の中の状態（`lastMs` と `counter`）だけで保つ。isolate をまたぐ順序はミリ秒の精度で、同じミリ秒の中は保証しない。
- `verify` の結合テストの探索先に `tests/` を足す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| `trim(x, <空白の集合>)`（採用） | 全角の空白だけの値も拒める | 式が長い |
| 素の `trim(x)` | 短い | タブ・改行・全角の空白だけの値が通る |
| `username` の形も DB の GLOB で縛る | 二重の防御 | 予約語などと規則が 2 か所に分かれる |
| 結合テストが実ファイルの D1（`.wrangler/state`）を使う | wrangler の実物に近い | スロットの状態を壊し、並列の実行で衝突する |

## 結果

- 以後のマイグレーションは同じ名前の付け方と空白の書き方を使う。制約名は [data-model.md](../architecture/data-model.md) に一覧する。
- テストの中のマイグレーションの適用は wrangler の `migrations apply` と同じ記録の表（`d1_migrations`）を使うので、2 回当てても何も起きない。SQL は `;` で文を区切れる形（文字列の中に `;` を置かない）で書く。
