---
type: ADR
title: "ADR-0063: スロットの reset と drop は、Garage の削除の後始末が捌けてから戻る"
description: "slot.mjs の reset と drop は、バケットを空にした後、garage stats の object の MklTodo が 500 未満になるまで 30 秒ごとに見て待つ（上限 30 分）。status で MklTodo と GcTodo を見られる。"
tags: [environment, garage, slot]
status: stable
---

# ADR-0063: スロットの reset と drop は、Garage の削除の後始末が捌けてから戻る

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0037](0037-serve-local-media-from-garage-web-endpoint.md)、[ADR-0060](0060-tests-clean-their-objects-and-slot-empties-buckets-in-parallel.md)、#117

## 背景

- `reset` と `drop` は、バケットのオブジェクトを消し終えた時点で戻る。Garage はその後も、削除の後始末（Merkle の更新。`garage stats` の `object` の行の MklTodo）を続ける。
- 2026-11-24、slot 2 の `reset` の直後に MklTodo が 0 から 45,486 になり、コンテナの CPU が 114% になった。その間に結合テスト 3 件が時間切れで落ちた（上限 5,000ms に対し 5,110ms）。MklTodo が 0 に戻ってから流し直すと通った。前日には約 200 万件の削除で MklTodo が 958 万件溜まり、`seed:bench` が 600 秒を超えた。

## 決定

- `reset` は `emptyBucket` の直後、`prepare` の手順の前に、`drop` はバケットの削除の後に、`waitForGarageDrain` で待つ。`prepare` は削除をしないので待たない。
- 待ちは `garage stats` の `Table stats` の `object` の行の MklTodo（4 列目）を見て、500 未満になるまで 30 秒ごとに `slot <N>: Garage の後始末を待っています（MklTodo=<n>）` を出す。ちょうど 500 は待つ。30 分待っても 500 未満にならなければ、手引きの「Garage が重い」を示して 1 で終わる。
- `garage stats` が読めないときは、既存の「共有のスタックが起動していません」で 1 で終わる。
- `node scripts/slot.mjs status` で `Garage: MklTodo=<n> GcTodo=<n>` を出す。GcTodo が 1,000,000 を超えるときは、ボリュームの作り直し（`docker compose down -v`、全スロットのデータが消える）は利用者が行うと 1 行足す。エージェントは作り直さない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 待たない（現状） | 速く戻る | 後始末の間の verify が時間切れで落ちる |
| 固定の時間待つ | 実装が単純 | 件数によって足りず、無駄にも待つ |
| MklTodo を見て待つ（採用） | 後始末が終わったことを観測して進む | `garage stats` の表の形に依存する |
| verify の側で待つ | 呼び出しが 1 か所 | reset / drop 以外の原因の負荷と区別がつかず、#111 のロックと役割が重なる |

## 結果

- reset / drop の後の verify は、Garage が落ち着いてから始まる。件数が多いと reset / drop は最長 30 分かかる。
- `garage stats` の表の列が変わると読めなくなり、スタック停止と同じ文言で止まる。`parseObjectQueues` とそのテストを直す。
- しきい値 500・間隔 30 秒・上限 30 分は `waitForGarageDrain` の引数で、テストでは時計と sleep を差し替える。
