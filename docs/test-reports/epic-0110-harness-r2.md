---
type: TestReport
title: EPIC #110 ハーネスの改善の総合試験（2 回目）
description: 統合ブランチ m2/cloudflare-demo の b522b94（#129・#130 を含む）で、EPIC #110 の受け入れ条件をコマンドでやり直した。1 回目に FAIL だった AC-5 と AC-6 を含む 8 つが PASS。AC-2 は Garage のボリュームの作り直しを待つため、今回も判定できず、EPIC はまだ閉じない。
tags: [epic-test]
---

# EPIC #110 ハーネスの改善の総合試験（2 回目）

## 対象

- EPIC: [#110](https://github.com/ohta-rh/insta-modoki/issues/110)
- 1 回目: [epic-0110-harness.md](epic-0110-harness.md)。AC-5 と AC-6 が FAIL、AC-2 は判定できなかった
- 試験した commit: `b522b94`（統合ブランチ `m2/cloudflare-demo`。#129・#130 を含む）
- 日付: 2026-11-24
- 形: 1 回目と同じく、各 AC の確認方法のコマンドを流して、出力を残した
- 記録: [evidence/epic-0110-r2/](evidence/epic-0110-r2/)
- 変わったこと: #129 のあと、main checkout を `m2/cloudflare-demo` に切り替えた。Director と subagent は、統合ブランチのハーネスを読むようになった（[harness-in-main-checkout.txt](evidence/epic-0110-r2/harness-in-main-checkout.txt)）

## 結果

**AC-2 を除いて PASS**。1 回目に FAIL だった AC-5 と AC-6 は PASS になった。AC-2 は利用者の操作（Garage のボリュームの作り直し）を待っているので、EPIC はまだ閉じない。

| AC | 結果 | 要点 |
|---|---|---|
| AC-1 verify は 1 本ずつ | PASS | 2 本目が待った。両方の最初と最後の行に `b522b94` |
| AC-2 reset は Garage の後始末を待つ | 判定できず | MklTodo が 65 万。作り直しの後にやり直す |
| AC-3 ADR の番号の検査 | PASS | 重複も、索引の漏れも、ファイル名つきで rc=1 |
| AC-4 `docs/log.md` の rebase | PASS | 衝突しない |
| AC-5 報告の `rc=` の行 | PASS | #130 の 3 つの報告に、確認ごとに `rc=` と結果の行がある |
| AC-6 見た目の PBI の長い文字の AC | PASS | #130 に、375px で 30 字・200 字の AC がある |
| AC-7 ci-gate | PASS | 起動時の hook の手順が、緑と差なしを出した。赤い枝では URL つきで rc=1 |
| AC-8 CI の E2E を 4 つに分ける | PASS | 最も遅い job は verify の 9 分 15 秒 |
| AC-9 手元の E2E が速くなる | PASS | 1 回目の記録のまま（このあと E2E の仕組みは変わっていない） |

## 受け入れ条件

### AC-1 — PASS

main checkout（`m2/cloudflare-demo`）と `.worktrees/epic-110` で、`node scripts/verify.mjs --only typecheck` を 2 秒ずらして流した（[ac1-a.log](evidence/epic-0110-r2/ac1-a.log)、[ac1-b.log](evidence/epic-0110-r2/ac1-b.log)）。

- 2 本目は 21:46:47 に `verify: 別の verify（pid 46238、…/insta-modoki/）が終わるまで待ちます` を出した。1 本目が 21:46:51 に終わってから、`verify: HEAD b522b94 epic-test/110` を出した
- 両方とも `verify: OK b522b94`、rc=0 で終わった

### AC-2 — 判定できず

Garage の MklTodo は 65 万（slot 4 の `drop` の最後の行は `30 分待っても Garage の後始末が終わりません（MklTodo=651025）`）。500 未満で戻ることは、今回も確かめられない。ボリュームの作り直し（`docker compose down -v`）は利用者が行う。その後に、この AC だけをやり直す。

### AC-3 — PASS

[ac3.log](evidence/epic-0110-r2/ac3.log) に記録した。

- 重複: `docs/adr: ADR の番号 0072 が 2 つあります: 0072-duplicate-number-probe.md, 0072-main-checkout-tracks-the-integration-branch.md`、rc=1
- 索引の漏れ: `docs/adr/index.md: 0073-missing-from-index-probe.md が索引にありません`、rc=1
- 一時的な ADR を消した後: `check-docs: OK (113 件の文書)`、rc=0

### AC-4 — PASS

[ac4.log](evidence/epic-0110-r2/ac4.log) に記録した。`b522b94` の `.gitattributes`（`docs/log.md merge=union`）で、同じ日付の見出しの下に 2 本の枝が足した行は、rebase しても衝突しなかった（`Successfully rebased`、rc=0）。両方の行が残った。

### AC-5 — PASS

#129 のあとに届いた #130 の報告を引用した（[ac5-quotes.txt](evidence/epic-0110-r2/ac5-quotes.txt)）。

- 実装者、code-reviewer、security-reviewer の 3 つとも、確認ごとに `rc=` と結果の行があった。例: `… echo "rc=$?"` → rc=0; "4 passed (4.7s)"
- 流さなかった確認は `未実行` と理由つきで書いてあった
- main checkout の 3 つの agent の定義には、それぞれ `rc=` の決まりがある（`grep -c rc=` が 3）
- 注意: #129 と #130 の subagent には、Director が「worktree の中の決まりを正として読め」とも指示していた。そのため、この報告の形が定義と指示のどちらから来たかは分けられない。次の dispatch では、その指示を付けずに確かめる

### AC-6 — PASS

開いている見た目の PBI の #130 には、375px で 30 字のユーザー名と、空白の無い 200 字のファイル名の AC がある（[ac6.txt](evidence/epic-0110-r2/ac6.txt)）。main checkout の `.claude/rules/issue-authoring.md` の 37 行目に、「見た目の PBI」の節がある。

### AC-7 — PASS

[ac7.log](evidence/epic-0110-r2/ac7.log) に記録した。

- main checkout で、`.claude/settings.json` の SessionStart の command と同じ手順を流した
  - `ci-gate: m2/cloudflare-demo は緑です（b522b94…）`
  - `harness-drift: main checkout のハーネスは origin/m2/cloudflare-demo と同じです`
- 赤い枝: `node scripts/ci-gate.mjs ci-red-check` → `… は failure です。ほかの作業より先に直してください: https://github.com/ohta-rh/insta-modoki/actions/runs/44853230180`、rc=1

### AC-8 — PASS

実行 45395127518（`b522b94`）の job を確かめた（[ac8-jobs.txt](evidence/epic-0110-r2/ac8-jobs.txt)）。

| job | 時間 |
|---|---|
| verify | 9 分 15 秒 |
| e2e (1/4) | 3 分 44 秒 |
| e2e (2/4) | 3 分 12 秒 |
| e2e (3/4) | 3 分 14 秒 |
| e2e (4/4) | 5 分 3 秒 |

最も遅いのは verify で、基準の 15 分 6 秒より短い。

### AC-9 — PASS

1 回目の記録（3.4m → 2.6m）のまま。#129 と #130 は E2E の仕組みを変えていない。今回の verify の E2E は `384 passed (2.2m)` だった（`b522b94`、#130 の verify）。

## この試験の間の Director の誤り

1 回目のレポートの commit の verify を、Director は「OK」と読んで push した。実際は `verify: FAIL integration-seed`（`オブジェクトを一覧できませんでした: 404`）だった。

- 原因: verify が slot 4 で走っている最中に、Director が同じ slot の `slot.mjs drop 4` を始めて、バケットを消した
- 届いていない通知（CI の緑）を前提に、次の PBI を dispatch した
- `62df26a` の CI は後で緑になったので、統合ブランチは赤にならなかった
- 訂正は [#110 のコメント](https://github.com/ohta-rh/insta-modoki/issues/110#issuecomment-7130710341)に書いた
