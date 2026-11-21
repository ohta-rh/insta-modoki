---
type: ADR
title: "ADR-0015: PBI と EPIC はグローバルの write-pbi スキルの水準で書き、このリポジトリの DoR・DoD を写す"
description: "issue の本文は ~/.claude/skills/write-pbi の型（ユーザーストーリー・根拠つきの根本原因・Given/When/Then の AC・決定済みの実装方針・触るファイル・最初に落とすテスト）で書く。このリポジトリのルールは、ラベル・階層・DoR・DoD の文言だけを持つ。"
tags: [process, issues]
status: stable
---

# ADR-0015: PBI と EPIC はグローバルの write-pbi スキルの水準で書き、このリポジトリの DoR・DoD を写す

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: ユーザー（PBI を x-modoki-v2・isuzu の水準にする、ルールはグローバルにする）。このリポジトリでの当てはめ方はエージェント
- 関連: [ADR-0004](0004-milestone-epic-pbi-with-dor-ac-dod.md)、[ADR-0005](0005-map-dependencies-for-parallel-work-at-filing.md)、グローバルの ADR-0005（`~/.claude/docs/adr/0005-one-global-issue-writing-standard.md`）

## 背景

2026-11-20 に起票した 51 の PBI の本文には、目的・スコープ・触るファイル・確認方法つきの AC・DoR・DoD しか無かった。ユーザーストーリー、根拠つきの根本原因、Given/When/Then、決定済みの実装方針、最初に落とすテストが無かった。ユーザーは、x-modoki-v2（例: issue #110）と isuzu（`.claude/rules/pbi.md`）の水準にすること、そのルールをプロジェクトごとではなくグローバルにすることを指示した。グローバルの `write-pbi` スキルを、その標準として作った。

## 決定

- このリポジトリの issue の本文は、`write-pbi` スキルの PBI と EPIC の型で書く。
- `.claude/rules/issue-authoring.md` は、このリポジトリの固有のことだけを持つ。マイルストーンの型、ラベル、DoR と DoD の文言、Wave の決め方の補足。
- PBI が共通に参照する設計の決まりを `docs/architecture/`（データモデル・URL とサーバーの処理・実装の共通の決まり）に置き、PBI の「実装方針」はその節を参照する。
- #18（技術スタック）より後の PBI では、フレームワークに依る部分（ルートのファイルの場所、DB の方言）を「未確定事項」に #18 と結び付けて書く。#18 が閉じたら、Director が着手の前に本文を更新する。
- 既存の 51 の PBI と 17 の EPIC は、番号を変えずに本文を書き直す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| グローバルの標準 + このリポジトリの固有の部分（採用） | 水準がリポジトリでぶれない | DoR と DoD の文言をこのリポジトリで保つ |
| このリポジトリのルールに全部書く | 1 か所で読める | ユーザーが望まない個別最適。他のリポジトリと水準がずれる |
| フレームワークが決まるまで PBI を書き直さない | 未確定事項が出ない | 決まるまで弱い PBI が残る |

## 結果

- 実装者は issue と `docs/architecture/` だけで、設計の判断をせずに着手できる。
- `docs/architecture/` を変える決定は、関係する PBI の本文も同じ変更の中で直す。
