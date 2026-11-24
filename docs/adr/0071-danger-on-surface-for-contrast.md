---
type: ADR
title: "ADR-0071: 灰色の面の上の誤りの文字は、対比のための派生色 --color-danger-on-surface を使う"
description: "--color-danger（#d62d3c）は surface（#f3f5f7）の上で 4.47:1 に届かない。参照の色は変えず、surface の上でだけ使う #c92a38（4.96:1）を足す。"
tags: [design-system, accessibility, color]
status: stable
---

# ADR-0071: 灰色の面の上の誤りの文字は、対比のための派生色 --color-danger-on-surface を使う

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0056](0056-ui-follows-measured-web-reference-under-own-brand.md)、EPIC #87、#126

## 背景

- EPIC #87 の総合試験の 2 回目（916efbc）で、作成のモーダルの「使えないファイル」の誤りが axe の `color-contrast` に落ちた。#d62d3c は白の上で 4.88:1 だが、`--color-surface`（#f3f5f7）の上では 4.47:1 で、4.5:1 に届かない。
- `design-system.md` は `text-danger` を surface の上に置かないと決めているが、作成のモーダルの選ぶ段は surface の上に誤りを出す。

## 決定

- 新しいトークン `--color-danger-on-surface: #c92a38`（surface の上で 4.96:1）を足す。誤りが surface の上に出る所でだけ `text-danger-on-surface` を使う。白の上は今までどおり `--color-danger`。
- `--color-danger` の値は変えない（参照の色は ADR-0056 のとおり）。足すのは対比のための派生色だけ。
- `contrast.ts` の `BODY_PAIRS` に `danger-on-surface`/`surface` を入れ、`contrast.test.ts` が 4.5:1 を確かめる。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| `--color-danger` を #c92a38 に変える | トークンが増えない | 参照の色（ADR-0056）から外れ、全画面の赤が変わる |
| surface の上の誤りの背景を白にする | 色が増えない | モーダルの見た目が参照と変わる |
| 派生色を足す（採用） | 参照を守り、必要な所だけ直る | トークンが 1 つ増え、置き場所の規則が要る |

## 結果

- surface の上の誤りは 4.5:1 以上になる。
- 以後、surface・highlight の上にエラーの文字を置くときは `text-danger-on-surface` を使う（highlight の上は未測定なので、置く前に対比を測る）。
