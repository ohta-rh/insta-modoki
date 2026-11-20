---
type: ADR
title: "ADR-0006: マイルストーン 1 はローカルの docker compose で動かす"
description: "最初のマイルストーンは、開発者のマシンで docker compose を使って動くところまでとする。クラウドへのデプロイは後のマイルストーンで行う。"
tags: [environment, milestone]
status: stable
---

# ADR-0006: マイルストーン 1 はローカルの docker compose で動かす

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー
- 関連: [ADR-0008](0008-share-one-compose-stack-with-a-slot-per-worktree.md)、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)

## 背景

アカウント・課金・シークレットはユーザーにしか扱えない。クラウドの準備を待つと、最初の機能が動くまでが遅れる。ユーザーは、まずローカルの docker compose で動かすと指定した。

## 決定

- マイルストーン 1 のゴールは「開発者のマシンで docker compose を使って動く」こと。
- アプリが必要とする backing service（データベース、R2 の代わりの S3 互換ストレージなど）は `compose.yaml` で起動する。
- クラウドのアカウントや課金が要る作業は、マイルストーン 1 に入れない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| ローカルの docker compose から（採用） | ユーザーの手を待たずに進められる。テストを再現しやすい | 本番との差は後で埋める |
| 最初からクラウドにデプロイする | 本番の制約に早く気づける | アカウントとシークレットの準備を待つ |

## 結果

- マイルストーン 1 はユーザーの操作なしに完了できる。
- 本番との差を小さくするため、コードは最初から Workers の実行環境の制約を守る（[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)）。
