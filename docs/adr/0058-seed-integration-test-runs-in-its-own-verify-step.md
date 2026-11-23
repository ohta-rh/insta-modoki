---
type: ADR
title: "ADR-0058: 結合テストの seed は他の結合テストと重ねず、verify の別の手順で後から流す"
description: "seed.int.test.ts の bench は共有の Garage に 62,084 回の CopyObject を 16 本並べて投げ、同じ vitest の他のテストの S3 の要求を最大 13 秒止める。verify の integration から外して integration-seed として後に流し、重なりを無くす。"
tags: [verify, testing]
status: stable
---

# ADR-0058: 結合テストの seed は他の結合テストと重ねず、verify の別の手順で後から流す

- ステータス: 採用
- 日付: 2026-11-23
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0024](0024-verify-command-and-coverage-gate.md)、[ADR-0046](0046-performance-budget-in-verify-and-ci.md)、#107

## 背景

- `integration` は全ての結合テストを 1 回の vitest で並べて流す。その中の `seed.int.test.ts` の bench は、1 回で media 15,581 行・CopyObject 62,084 回を共有の Garage に 16 本並べて投げる。
- 計測（2026-11-23、slot 4）: 16 本の CopyObject を 60 秒投げ続けた間、他の要求の待ちは p50 28ms・p99 1,203ms・最大 13,351ms。小さな PUT だけなら p99 102ms・最大 1,598ms。
- 同じ日に、変更と関係の無い結合テスト（`admin-delete-user` と `presign`）が既定の 5 秒で 2 回落ちた。どちらも単独では通る。
- 同時の本数（16）を 4 に下げると、30 秒の複製の数が 9,806 から 1,514 に 6 倍遅くなり、待ちの最大は 2,139ms から 1,175ms にしか下がらなかった。

## 決定

- verify の `integration` は `src/shared/db/seed/seed.int.test.ts` を除いて流す（`--exclude`）。
- その直後に手順 `integration-seed` を足し、そのファイルだけを流す。seed は他の結合テストと重ならない。
- bench を小さくしない・既定の手順から外さない・同時の本数を変えない・vitest の既定の上限を変えない。
- テストの総数は変えない。分けた 2 つの手順の合計が、今の `integration` 1 回と同じ件数であること。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 手順を分けて seed を後に流す（採用） | 同じ実行の中の原因が無くなる。門は緩めない | 手順が 1 つ増える。seed の間は他のテストが止まっている分だけ総時間は少し延びうる |
| 同時の本数を 4 に下げる | 変更が小さい | 6 倍遅くなるうえ、待ちの最大がはっきり良くならない |
| bench を小さくする・既定から外す | 速い | 門を緩める変更で、利用者だけが決める |
| 既定の上限を上げる | 変更が小さい | 次に遅くなるテストを止める確認にならない。門を緩める |
| ホスト全体の鍵でワークツリーの verify を順番にする | 他のワークツリーとの重なりも消える | Director がスロットを並べる意味が無くなる |

## 結果

- 同じ verify の中では、bench が他の結合テストの S3 の要求を止めない。
- 受け入れる費用: 他のワークツリーの verify の bench との重なりは残る。時間の予算の確認（[ADR-0059](0059-integration-tests-stay-within-a-quarter-of-their-timeout.md)）でテストの余裕を持たせて備える。
- 守ること: `seed.int.test.ts` 以外の結合テストを `integration-seed` に移さない。新しく共有の資源を大量に使う結合テストを足すときは、同じように別の手順にする。
