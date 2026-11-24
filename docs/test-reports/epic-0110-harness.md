---
type: TestReport
title: EPIC #110 ハーネスの改善の総合試験
description: 統合ブランチ m2/cloudflare-demo の cc7eef4 で、EPIC #110 の 9 の受け入れ条件をコマンドで確かめた。7 つが PASS、AC-5 と AC-6 が FAIL、AC-2 は Garage の状態のため判定できなかった。FAIL の 2 つの根本原因は同じで、統合ブランチに入ったハーネスの決まりが、main checkout（m1/local-mvp）から読み込む Director と subagent に届いていない。
tags: [epic-test]
---

# EPIC #110 ハーネスの改善の総合試験

## 対象

- EPIC: [#110](https://github.com/ohta-rh/insta-modoki/issues/110)
- 試験した commit: `cc7eef4`（統合ブランチ `m2/cloudflare-demo`）。`epic-test/110` はその上にこのレポートだけが載る
- 日付: 2026-11-24
- 形: この EPIC には画面が無いので、起票のときに決めたとおり、各 AC の確認方法のコマンドを流して出力を残した（実ブラウザの操作は無い）
- 記録: [evidence/epic-0110/](evidence/epic-0110/)
- 機械の状態: load average は 10〜14（16 CPU。ほかのプロジェクトの container も動いていた）。Garage は `MklTodo=1118685 GcTodo=1631810`（`node scripts/slot.mjs status`、20:46）

## 結果

**FAIL**。AC-5 と AC-6 が FAIL、AC-2 は判定できなかった。ほかの 6 つは PASS。

| AC | 結果 | 要点 |
|---|---|---|
| AC-1 verify は 1 本ずつ | PASS | 2 本目が待ち、両方の最初と最後の行に `cc7eef4` |
| AC-2 reset は Garage の後始末を待つ | 判定できず | MklTodo が 110 万で、500 未満まで下がらない |
| AC-3 ADR の番号の検査 | PASS | 重複も索引の漏れもファイル名つきで rc=1 |
| AC-4 `docs/log.md` の rebase | PASS | union で衝突しない。union を外すと衝突する |
| AC-5 報告の `rc=` の行 | FAIL | 報告が ADR-0065 の Evidence の形になっていない |
| AC-6 見た目の PBI の長い文字の AC | FAIL | #124〜#127 に長い文字の AC が無い |
| AC-7 ci-gate | PASS | 赤い枝で URL つきの rc=1、緑の枝で rc=0 |
| AC-8 CI の E2E を 4 つに分ける | PASS | 最も遅い job は verify の 9 分 24 秒（基準は 15 分 6 秒） |
| AC-9 手元の E2E が速くなる | PASS | 3.4 分から 2.6 分（件数は、足した 1 件を除いて同じ） |

## 受け入れ条件

### AC-1: 2 つの worktree で同時に verify を始めると、2 本目が待つ — PASS

`.worktrees/m2` と `.worktrees/epic-110`（どちらも `cc7eef4`）で `node scripts/verify.mjs --only typecheck` を 2 秒ずらして流した（[ac1-a.log](evidence/epic-0110/ac1-a.log)、[ac1-b.log](evidence/epic-0110/ac1-b.log)）。

- 2 本目の最初の行: `verify: 別の verify（pid 92443、…/.worktrees/m2/）が終わるまで待ちます`
- 2 本目は 1 本目が終わった 20:47:40 の後に `verify: HEAD cc7eef4 epic-test/110` を出し、20:47:50 に `verify: OK cc7eef4` で終わった
- 1 本目は `verify: HEAD cc7eef4 m2/cloudflare-demo` で始まり、`verify: OK cc7eef4` で終わった。どちらも rc=0
- 補足: 最初に確認方法どおり `--only docs` で流したが、1 本目が 1 秒かからずに終わり、重ならなかった（2 本とも待たずに OK）。重なる長さの手順で流し直した

### AC-2: `reset` は MklTodo が 500 未満になってから戻る — 判定できず

`MklTodo` は 110 万〜216 万で、30 分の間に 500 未満まで下がらなかった。このため、「戻ってから verify を流す」の組を作れなかった。

- この試験の前の片付けで、slot 1〜4 の `drop` が 4 回とも 30 分待ってから時間切れになった。最後の行は `slot 1: 30 分待っても Garage の後始末が終わりません（MklTodo=1976097）。docs/guides/local-development.md の「Garage が重い」を見てください`
- 待つことと、時間切れで止まることの経路は、この記録で確かめられた
- 500 未満で戻ることを確かめるには、Garage のボリュームを作り直す必要がある（`docker compose down -v`。全スロットのデータが消えるので、利用者が行う）。作り直した後に、この AC だけをやり直す

### AC-3: ADR の番号の重複と、索引にない ADR で落ちる — PASS

作業ツリーに一時的な ADR を置いて `node scripts/check-docs.mjs docs` を流し、流した後に消した（[ac3.log](evidence/epic-0110/ac3.log)）。

- 重複: `docs/adr: ADR の番号 0071 が 2 つあります: 0071-danger-on-surface-for-contrast.md, 0071-duplicate-number-probe.md`、rc=1
- 索引の漏れ: `docs/adr/index.md: 0072-missing-from-index-probe.md が索引にありません`、rc=1
- 消した後: `check-docs: OK (111 件の文書)`、rc=0

### AC-4: 同じ日付の見出しの下への追記が、rebase で衝突しない — PASS

scratchpad の一時的なリポジトリに、このリポジトリの `.gitattributes`（`docs/log.md merge=union`）を写して流した（[ac4.log](evidence/epic-0110/ac4.log)）。

- 枝 `a` と `b` が `## 2026-11-24` の下に 1 行ずつ足し、`b` を `a` の上に rebase すると `Successfully rebased`、rc=0。両方の行が残った
- 対照として、union を外した同じ手順（`.git/info/attributes` に `docs/log.md -merge`）では `CONFLICT (content): Merge conflict in docs/log.md`、rc=1

### AC-5: 報告の全ての確認に `rc=` の行と結果の行がある — FAIL

#114（ADR-0065）の後に届いた報告を読んだ。報告は全部、決まりの Evidence の節を持たず、文の中に `rc=0` を混ぜる形だった。

- 例: #128 の code-reviewer の報告は、`pnpm vitest run scripts/eslint-config.test.ts passes both tests with rc=0` と文の中に書いていた
- 例: #125 の 2 回目の修正の security-reviewer の報告は、`git diff … (exit 0)` と書き、`rc=` の行が無かった
- 原因: subagent の定義は main checkout から読み込まれる。main checkout は `m1/local-mvp` のままで、そこにある `.claude/agents/code-reviewer.md` には `rc=` が 0 回しか出ない。統合ブランチの同じファイルには 3 回出る（`git show m1/local-mvp:.claude/agents/code-reviewer.md | grep -c rc=` は 0、`git show origin/m2/cloudflare-demo:… | grep -c rc=` は 3）

### AC-6: 開いている見た目の PBI に、狭い画面の長い文字の AC がある — FAIL

#118（ADR-0066）の後に起票した見た目の PBI の #124、#125、#126、#127 を読んだ。

- どれにも、長い文字の AC が無かった。当てはまらない理由を書いた文も無かった（`gh issue view` の本文を `長い|空白のない|ADR-0066|当てはまら` で探して 0 件）
- #124 は、利用者が付ける名前（username）のリンクの形を変えた（`inline-block`・`min-w`）。長い名前が来たときの 375px の幅は確かめていない
- 原因は AC-5 と同じ。起票した Director（このセッション）が読む `.claude/rules/issue-authoring.md` は main checkout の `m1/local-mvp` の版で、「見た目の PBI」の節が無い

### AC-7: 統合ブランチの最新の CI が赤いと、ci-gate が URL を出して 1 で終わる — PASS

[ac7.log](evidence/epic-0110/ac7.log) に記録した。

- 最新の CI が failure の枝: `node scripts/ci-gate.mjs ci-red-check` は `… は failure です。ほかの作業より先に直してください: https://github.com/ohta-rh/insta-modoki/actions/runs/44853230180`、rc=1
- 緑の枝: `node scripts/ci-gate.mjs m2/cloudflare-demo` は `m2/cloudflare-demo は緑です（cc7eef4…）`、rc=0
- 最新が取り消しの枝は、今のリポジトリに無かった。取り消しの経路は `scripts/ci-gate.test.ts` の `a failed or cancelled latest run exits 1 with the run URL` が `cancelled` で確かめている（verify の unit で緑）

### AC-8: CI の E2E が 4 つの job に分かれ、最も遅い job が 15 分 6 秒より短い — PASS

実行 45366041819（`cc7eef4`）の job（[ac8-jobs.txt](evidence/epic-0110/ac8-jobs.txt)）を確かめた。

| job | 時間 |
|---|---|
| verify（E2E を除く） | 9 分 24 秒 |
| e2e (1/4) | 4 分 24 秒 |
| e2e (2/4) | 3 分 36 秒 |
| e2e (3/4) | 3 分 3 秒 |
| e2e (4/4) | 4 分 46 秒 |

5 つの job は同じ 09:31:45 に始まった。最も遅いのは verify の 9 分 24 秒で、基準の 15 分 6 秒より短い。

### AC-9: 手元の E2E が速くなる — PASS

#116 の記録（issue のコメント）を確かめた。

- 変更前: `327 passed` で 3.4m（ほかに 1 failed、2 did not run）
- 変更後: `331 passed` で 2.6m
- 件数: 変更前の 330 件に、#116 で足した `e2e/support/auth.spec.ts` の 1 件が加わった。これを除くと件数は同じ
- 負荷が違う 2 回を比べたため、#116 では、1 人分の用意を同じサーバーの上で交互に 10 回ずつ測った。平均で約 130ms 短かった

## 見つかった問題

1. **統合ブランチのハーネスの決まりが、それを使う Director と subagent に届かない**（AC-5、AC-6）。
   - Director のセッションと subagent の定義は、main checkout（`m1/local-mvp` のまま）の `CLAUDE.md`・`.claude/` を読む
   - ADR-0017 で作業を統合ブランチに積むようになってから、ハーネスの変更は利用者が PR を merge するまで効かない
   - #114 の報告で注意として書いたが、仕組みの穴として起票していなかった
2. **ADR-0066 の後の見た目の PBI（#124〜#127）に、長い文字の AC が無い**（AC-6 の結果）。#124 の名前のリンクは、長い username の 375px で確かめていない。

## 片付け

- AC-3 の一時的な ADR は 2 つとも消した（`git status` は clean）
- AC-4 の一時的なリポジトリは scratchpad の中にある
