---
type: ADR
title: "ADR-0060: 結合テストはスロットのバケットに作ったファイルを消して終わり、slot.mjs はバケットを 32 本並べた DELETE で空にする"
description: "seed の結合テストが verify のたびに約 64,000 個を残し、reset / drop が 1 個ずつ消して 1 時間を超えた。テストは作ったファイルを消して終わり、emptyBucket は 32 本並べた DELETE で進み具合を出して消す。DeleteObjects とバケットの作り直しは選ばない。"
tags: [verify, testing, local-environment]
status: stable
---

# ADR-0060: 結合テストはスロットのバケットに作ったファイルを消して終わり、slot.mjs はバケットを 32 本並べた DELETE で空にする

- ステータス: 採用
- 日付: 2026-11-23
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0023](0023-slots-with-garage-and-d1-files.md)、[ADR-0037](0037-serve-local-media-from-garage-web-endpoint.md)、[ADR-0058](0058-seed-integration-test-runs-in-its-own-verify-step.md)、#108

## 背景

- 2026-11-23、`node scripts/slot.mjs reset <N>` が 90 分を超えても終わらず止めた。何も出力しなかった。
- `seed.int.test.ts` は D1 をメモリ（`persist: false`）で毎回空にして始めるので、seed の後片付けが前の回のファイルを見つけられず、verify のたびにスロットのバケットに約 64,000 個が残る。`insta-s2` は 450,620 個。
- `emptyBucket` は 1 個ずつ順に DELETE（Garage v2.5.0 で 1 個 20.2ms、500 個 10,079ms）。450,620 個で約 2.5 時間。
- 同じ 1,000 個の計測: 16 本並べて 3,574ms、32 本 1,271ms、64 本 1,104ms、DeleteObjects 1 回 9,910ms（Garage は 1 回の中を順に消す）、250 個 × 4 本 1,204ms。負荷の高いときの 32 本は 1 個 2.7〜3.8ms。
- Garage v2.5.0 の `garage bucket` に中身ごと消す操作は無く、`bucket delete` は空のバケットにしか使えない。

## 決定

- 結合テストは、スロットのバケットに作ったファイルを、そのテストの最後に消して終わる。`seed.int.test.ts` は最後に `removeSeed`（今の `cleanup`。ファイルを消してから行を消す）を呼び、行とファイルが残っていないことと、バケットのオブジェクトの数が増えていないことを確かめる。
- `slot.mjs` の `emptyBucket` は list した全ての key を 32 本並べた DELETE で消す。1 つ失敗したら新しい DELETE を始めず、動いている分の終わりを待って最初のエラーで終わる。10,000 個ごとと最後に消した数を出し、0 個なら「空です」と出す。無い key の DELETE は 204 なので、何度流してもよい。
- 32 本は、64 本でほぼ伸びが止まり、共有の Garage を他のスロットと分け合うため。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 32 本並べた DELETE（採用） | 1 個 約 1〜4ms。今の `deleteObject` を使い回せる | 本数は計測で決めた値 |
| 1 個ずつ順に DELETE（今） | 単純 | 1 個 20ms。450,000 個で 2.5 時間 |
| DeleteObjects（複数をまとめて消す API） | 往復が減る | Garage は 1 回の中を順に消す（1 個 9.9ms）。並べると DELETE と同じ速さで、XML・Content-MD5・応答の個々の `<Error>` の読み取りが増える |
| バケットを消して作り直す | 一瞬 | Garage v2.5.0 は空でないバケットを消せない。鍵の許可・CORS・ウェブ公開を作り直す必要もある |
| テストが残すのを許し、`reset` だけで掃除する | 変更が小さい | 溜まる量が減らない。`drop` も同じだけ待つ |

## 結果

- `reset` / `drop` は 32,000 個で 5 分以内（計測では約 2 分）。進み具合が出るので止めるかどうかを判断できる。
- `seed.int.test.ts` は最後に 62,324 個を 16 本ずつ消すので 2〜4 分延びる（上限 600 秒）。
- 今後、数百個を超えるファイルをスロットのバケットに作る結合テストは、同じく最後に消す。小さい残り（`media/presign-test/` など）は `reset` で消える。
