---
type: ADR
title: "ADR-0065: サブエージェントの報告は、確認ごとに rc の行と結果の行を写し、道具が起動しなければ止まる"
description: "pbi-implementer・code-reviewer・security-reviewer・epic-tester は、確認を rc を取る形で流し、報告にコマンド・rc の行・結果の行を写す。走らせていない確認は「未実行」と書く。最初に pnpm --version を確かめ、起動しなければ BLOCKED（レビュー役は CHECKED に未実行）。Director は AC の判定に使う行を流し直すかログで照合する。"
tags: [delivery, agents, verify]
status: stable
---

# ADR-0065: サブエージェントの報告は、確認ごとに rc の行と結果の行を写し、道具が起動しなければ止まる

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0010](0010-independent-code-and-security-review.md)、[ADR-0012](0012-epic-integrated-test-in-real-browser.md)、#114

## 背景

- #93 の実装者は余白の E2E が通ったと報告したが、そのテストは border box を測っていて通るはずがなかった。2026-11-23 に Director が流し直して発覚した。
- 2026-11-24 の #93 のコードレビューは、`tsc` の `rc=0` が `tail` の終了コードだったと自分で書いた。
- 同じ日、`pnpm` が `ENOEXEC`（`Failed to switch pnpm to v12.18.0`）で起動しなかった。レビュー役は報告の最後に書いて `node_modules/.bin` に切り替えて続けた。
- 4 つの定義は「実行したコマンドと終了コード」「command + output line」とだけ書き、終了コードの取り方と写す行を決めていなかった。

## 決定

- `pbi-implementer`・`code-reviewer`・`security-reviewer`・`epic-tester` の定義に `## Evidence` の節を置く。確認は `cmd > "$LOG" 2>&1; echo "rc=$?"` の形で流し（パイプで包まない）、報告にはコマンド・`rc=<n>` の行・結果の行（`N passed`、`✘ ...`）をそのまま写す。走らせていない確認は `未実行` と理由を書き、通ったと書かない。
- 4 つの定義の最初の手順に `pnpm --version` を置く。起動しなければ出力を写し、実装者と EPIC の試験役は `BLOCKED`、レビュー役は `CHECKED` に `未実行（pnpm が起動しない: <出力>）` を返す。`node_modules/.bin` や `npx` など別の起動方法へ勝手に切り替えない。
- `.claude/rules/delivery.md` §3 に、報告の `rc=` の行と結果の行のうち AC の判定に使うものは、Director が流し直すかログを開いて照合する、と書く。同じ変更で、§2 の 1 と §4 の 2 に `node scripts/ci-gate.mjs <統合ブランチ>` が 0 であることを書く（本体は #115）。
- `scripts/agents.test.ts` が、これらの文言が消えないことを見る。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 「終了コードを報告する」の一文のまま（現状） | 変更なし | 取り違えた rc や走っていない確認が報告に入る |
| 報告に rc の行と結果の行を写す + 起動しなければ止まる（採用） | Director がその場で照合できる。道具の不調が報告になる | 報告が少し長い。文言の維持にテストが要る |
| Director が全ての確認を流し直す | 最も確実 | 並列化の利点が消え、時間が倍になる。AC の判定に使う行だけに絞った |
| 起動しない pnpm を別の方法で補う | 作業が止まらない | 検証した道具と違うものを使った結果を「通った」と読ませる。止めて Director が直す |

## 結果

- 報告の「通った」に、開ける行が付く。道具が起動しないことは `BLOCKED` や `未実行` として届く。
- 受け入れる費用: 報告が長くなり、Director は判定に使う行の照合に時間を使う。
- 守ること: 新しいエージェントの定義にも `## Evidence` と最初の `pnpm --version` を置き、`scripts/agents.test.ts` の対象に足す。
