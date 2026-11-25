---
type: TestReport
title: EPIC #110 ハーネスの改善の総合試験（3 回目、AC-2）
description: Garage の MklTodo が 0 まで捌けたので、1・2 回目に判定できなかった AC-2 だけを 340dff7 でやり直した。seed 済みの slot 4 の reset は MklTodo=1791 を待って 34 秒で戻り、続く verify の結合テストは全て時間内に緑。AC-2 は PASS。続く E2E で、試験どうしの干渉による失敗が見つかり、#131 を起票した。
tags: [epic-test]
---

# EPIC #110 ハーネスの改善の総合試験（3 回目、AC-2）

## 対象

- EPIC: [#110](https://github.com/ohta-rh/insta-modoki/issues/110)
- これまでの回:
  - 1 回目: [epic-0110-harness.md](epic-0110-harness.md)
  - 2 回目: [epic-0110-harness-r2.md](epic-0110-harness-r2.md)。AC-2 のほかは PASS
- 試験した commit: `340dff7`（統合ブランチ `m2/cloudflare-demo`）
- 日付: 2026-11-24
- やり直した AC: AC-2 だけ（ほかの AC は 2 回目で PASS）
- 記録: [evidence/epic-0110-r3/](evidence/epic-0110-r3/)
- 前提:
  - 片付けの `drop` が続いて、Garage の MklTodo が 0 まで下がった（`Garage: MklTodo=0 GcTodo=1998127`）
  - GcTodo（削除の跡）は 200 万のまま。作り直しは利用者が行う

## 結果

**AC-2 は PASS**。これで EPIC #110 の 9 つの AC は、全て PASS になった（AC-2 は 3 回目、ほかは 2 回目）。

## AC-2: seed 済みのスロットで reset すると、MklTodo が 500 未満になってから戻り、続く verify の結合テストが時間切れで落ちない — PASS

slot 4 で、次の順に流した（[ac2.log](evidence/epic-0110-r3/ac2.log)）。

1. 22:11:14 `pnpm seed:demo` → rc=0、`seed: demo OK users=30 posts=300 media=473`
   - パスワードは画面に出さず、記録にも残していない
2. 22:11:36 `node scripts/slot.mjs status` → `Garage: MklTodo=0 GcTodo=1998127`
3. 22:11:36 `node scripts/slot.mjs reset 4`
   - `バケット insta-s4 のオブジェクトを 1892 / 1892 個消しました`
   - `slot 4: Garage の後始末を待っています（MklTodo=1791）`
   - `slot 4 を初期化しました（insta-s4、PORT=3104、.dev.vars）`
   - 記録の `rc=` が空なのは、記録の取り方の誤り（zsh では `PIPESTATUS` が使えない）。成功の行は出ている
4. 22:12:10 `node scripts/slot.mjs status` → `Garage: MklTodo=0 GcTodo=2000019`
   - reset は、MklTodo が 1791 から 500 未満になるのを待ってから戻った（34 秒）
5. 22:12:10 `PORT=3104 node scripts/verify.mjs`（[ac2-verify-summary.log](evidence/epic-0110-r3/ac2-verify-summary.log)）
   - unit: `755 passed`
   - integration: `405 passed | 4 skipped`
   - integration-seed: `14 passed`（1・2 回目の前の失敗はここだった）
   - int-budget・build: OK
   - 結合テストは、全て時間内に終わった

## AC-2 の外で見つかったこと

同じ verify の `e2e` の手順は、`verify: FAIL e2e` で終わった。

- 落ちたのは `e2e/follow.spec.ts` の 2 つで、`Received: "2 フォロワー"`
- 原因: `e2e/visual-home-aside.spec.ts` の `候補がいなければおすすめの見出しを出さない` が、DB の全員をフォローする。そのため、同時に走るテストの新しい利用者にも、フォロワーが 1 人増える
- 同時に流す組み合わせで再現した（`1 failed`、`17 passed`）。単独では `30 passed`
- AC-2（reset と結合テスト）とは関係がない。EPIC #87 の下に [#131](https://github.com/ohta-rh/insta-modoki/issues/131) として起票した
