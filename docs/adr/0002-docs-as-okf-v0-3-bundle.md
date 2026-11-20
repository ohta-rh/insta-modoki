---
type: ADR
title: "ADR-0002: docs/ を Open Knowledge Format（OKF）v0.3 のバンドルとして管理する"
description: "ドキュメントは全て docs/ に置き、okf_version 0.3 を宣言した OKF バンドルにする。文書は type を持つ frontmatter 付きの Markdown、index.md と log.md は frontmatter を持たない。"
tags: [process, docs]
status: stable
sources:
  - id: okf-spec-v0-3
    resource: https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format SPEC.md (v0.3)
---

# ADR-0002: docs/ を Open Knowledge Format（OKF）v0.3 のバンドルとして管理する

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（OKF v0.3 の指定）。各ファイルの書き方の細部はエージェント
- 関連: [ADR-0001](0001-record-architecture-decisions.md)

## 背景

ユーザーは、ドキュメントを OKF v0.3 で管理すると指定した。2026-11-20 に一次情報を確かめた。v0.3 の仕様は `open-knowledge-format/open-knowledge-format` の `SPEC.md` にある。それまでの `GoogleCloudPlatform/open-knowledge-format` は非推奨になり、v0.2 のまま止まっている。v0.3 の要点は次のとおり。

- 文書（concept）は、frontmatter に空でない `type` を持つ `.md` ファイル。必須のキーは `type` だけ（§3.2、§4.1）。
- `index.md` と `log.md` は予約されたファイル名。サブディレクトリの `index.md` と全ての `log.md` は frontmatter を持たない。frontmatter を持てるのはルートの `index.md` だけで、`okf_version`・`title`・`description`・`license` を書ける（§8、§9）。
- 状態は `status: draft | stable | deprecated` で表し、置き換えには `superseded_by` を使う（§5.4）。
- リンクは標準の Markdown リンク。ファイルからの相対パスと、`/` から始まるルートからのパスの両方が使える（§6）。`.md` でないファイルは asset（§3.2）。
- v0.2 からの破壊的な変更は 2 つ。`/` の無いパスはファイルのあるディレクトリから解決する。trust tier は最新の検証だけで決まる（§13.1）。

## 決定

- プロジェクトのドキュメントは全て `docs/` に置く。`docs/` を OKF v0.3 のバンドルの root にし、`docs/index.md` に `okf_version: "0.3"`・`title`・`description` を書く。
- 文書には `type`・`title`・`description` を必ず書く。使う `type` は `docs/index.md` に一覧にし、新しい type は一覧に足してから使う。
- ADR のステータスは OKF の `status` に合わせる。提案は `draft`、採用は `stable`、却下・廃止・置き換えは `deprecated`。
- 各ディレクトリの `index.md` と `docs/log.md` は frontmatter を持たず、§8 と §9 の形で書く。
- ルール本体は `.claude/rules/documentation.md` に置く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| OKF v0.3（採用） | 種類・要約・状態が frontmatter だけで分かる。エージェントと人の両方が読める。ツールに依存しない | 文書を足すたびに index.md と log.md を直す |
| OKF v0.2（兄弟プロジェクトと同じ） | 前例がある | 非推奨のリポジトリの版。パスの解決規則が v0.3 と違う |
| 決まりの無い Markdown | 手間が無い | 状態・種類・置き換えがエージェントに読めない |

## 結果

- 文書の状態と置き換えの関係を、エージェントが frontmatter だけで判断できる。
- `docs/` を変えるときは `docs/log.md` と、そのディレクトリの `index.md` も同じ commit で直す。
- 同じ間違いが 2 回起きたら、検査スクリプトにして verify に入れる。
