---
type: ADR
title: "ADR-0009: PBI は TDD → 実装 → レビュー → E2E → verify を、AC と DoD を満たすまで繰り返す"
description: "PBI ごとに、落ちるテストを先に書いて実装し、独立したレビューを受け、E2E と verify を通す。どこかで満たさなければ TDD に戻り、AC と DoD が全て満たされるまで繰り返す。"
tags: [process, delivery, testing]
status: stable
---

# ADR-0009: PBI は TDD → 実装 → レビュー → E2E → verify を、AC と DoD を満たすまで繰り返す

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（ループの順番と終わりの条件）。各段の細則はエージェント
- 関連: [ADR-0004](0004-milestone-epic-pbi-with-dor-ac-dod.md)、[ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)、[ADR-0010](0010-independent-code-and-security-review.md)

## 背景

ユーザーは、サブエージェントが TDD → 実装 → コードレビュー → E2E → verify の順に進め、issue の AC と DoD を満たすまで繰り返すと指定した。

## 決定

- **TDD → 実装**: AC ごとに、先に落ちるテストを書き、期待した理由で落ちるのを見てから、通る最小のコードを書いて整える。落ちた出力を TDD の記録に残す（`.claude/rules/tdd.md`）。
- **レビュー**: code-reviewer と security-reviewer を同時に、それぞれ独立して動かす（[ADR-0010](0010-independent-code-and-security-review.md)）。直すべき指摘があれば TDD に戻る。
- **E2E**: 画面で観測できる AC の全部に Playwright のシナリオを置き、スロットのアプリに対して通す。
- **verify**: verify コマンド（全ての確認）が worktree で 0 で終わる。最後に Director が、各 AC を確認方法どおりに、各 DoD の項目を証拠と照らして確かめる。
- どの段で失敗しても TDD に戻る。コードが変わったら、レビューを新しいレビュアーでやり直す。
- ループは、AC と DoD が全て満たされたときにだけ終わる。レビューが 3 回通らなければ、最後の緑の状態に戻して変更を小さく分ける。ユーザーには聞かない。
- verify コマンドの中身は、マイルストーン 1 の最初の基盤の PBI で決め、ADR に残す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| TDD → 実装 → レビュー → E2E → verify のループ（採用） | どの段で失敗しても戻る先が決まっている。レビューで直したものも E2E で確かめる | 1 つの PBI の往復が増える |
| E2E の後にレビュー | レビュアーが E2E の結果を見られる | E2E の後にコードが変わると、E2E をやり直す |
| テストは実装の後に書く | 速く見える | 失敗を見ていないテストは、何も確かめていないかもしれない |

## 結果

- issue を閉じる条件が AC と DoD だけで決まる。
- テストを飛ばす・弱める・カバレッジから外す、で通すことはしない。
