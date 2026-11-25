---
type: ADR
title: "ADR-0064: docs/log.md は union merge で統合する"
description: ".gitattributes の docs/log.md merge=union で、日付の見出しの直下への別々の追記を rebase で衝突させず、両方の行を残す。docs/**/index.md は並びに意味があるので対象にしない。"
tags: [docs, git]
status: stable
---

# ADR-0064: docs/log.md は union merge で統合する

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0002](0002-docs-as-okf-v0-3-bundle.md)、[ADR-0017](0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)、#113

## 背景

- `docs/log.md` は `## <日付>` の見出しの直下に PBI ごとの 1 行を足す、追記だけの共有ファイルである。
- リポジトリに `.gitattributes` がなく、通常の 3-way merge で扱われるため、並行する PBI が同じ位置へ別々の行を足すと、rebase のたびに `CONFLICT (content): Merge conflict in docs/log.md` になる。2026-11-23〜24 の #98・#99・#93・#108 では Director が毎回手で直した。

## 決定

- ルートの `.gitattributes` に `docs/log.md merge=union` の 1 行を置き、`docs/log.md` を union merge で統合する。
- ほかのファイル（`docs/**/index.md` を含む）には union を付けない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 衝突を Director が手で直す（現状） | 設定が要らない | rebase のたびに同じ手作業が起きる |
| `docs/log.md` だけ union（採用） | 1 行で衝突が消える。log の行は PBI 番号を含み一意なので、重複した行が残る場面がない | 両側の行の並びは git が決める（日付ごとの先頭付近に入る） |
| `docs/**/index.md` も union | 同じ衝突も消える | 並びに意味がある表を持ち、union では重複した行が黙って残る |
| 追記を 1 PBI 1 ファイルに分ける | 衝突しない | log の形（日付ごとの一覧）が変わり、読む側が増える |

## 結果

- Director は log の衝突を直さなくてよくなる。`.claude/rules/issue-authoring.md` の追記だけの共有ファイルの段落を合わせた。
- 同じ行を 2 本が足すと重複するが、行は PBI 番号を含むので起きない。
- `scripts/gitattributes.test.ts` が、`docs/log.md` だけが union であること、別々の追記が衝突なく rebase できることを守る。
