---
type: ADR
title: "ADR-0070: 手元の E2E も、落ちたテストの trace を残す"
description: "playwright.config.ts の use.trace は、手元でも CI でも retain-on-failure にする。通ったテストの trace は捨てられ、落ちたテストだけ test-results/<test>/trace.zip に残る。"
tags: [testing, e2e]
status: stable
---

# ADR-0070: 手元の E2E も、落ちたテストの trace を残す

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。#123）
- 関連: [ADR-0027](0027-ci-runs-verify-and-docs-check.md)、[ADR-0069](0069-e2e-signs-in-through-the-harness.md)

## 背景

- `playwright.config.ts` は、CI でだけ `trace: 'retain-on-failure'` を有効にし、手元では `'off'` だった。
- 2026-11-24 の手元の verify で、送信の後の `toHaveURL` が 5,000ms で時間切れになり、画面が送信中のままという落ち方が 4 回あった（`e2e/a11y.spec.ts`、`e2e/profile-edit.spec.ts`、`e2e/post-create.spec.ts`）。手元には画面の記録しか残らず、どの要求が遅れたかが分からなかった。#120 で計測を入れた 5 回は再現しなかった。

## 決定

- `use.trace` を、手元でも CI でも `'retain-on-failure'` にする。`reporter` は変えない（手元は `list`、CI は `list` と `html`）。
- 手元では落ちたテストの `test-results/<テスト名>/trace.zip` に残り、`pnpm exec playwright show-trace` で読む。読み方は `docs/guides/verify.md` に書く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 手元も `retain-on-failure`（採用） | 落ちた回の記録が必ず残る。通った回に残らない | 通った回も、記録を取って捨てる分の負担がある |
| `on-first-retry` | 負担が小さい | 手元は再試行をしないので、何も残らない |
| `on`（常に残す） | 取りこぼしが無い | 通った回の trace でディスクと時間を使う |
| 何もしない | 変更なし | 原因の分からない落ち方が続く |

## 結果

- 手元で落ちた E2E の送信の要求（server action の `POST`、S3 への `PUT`）の時刻を後から確かめられる。
- 通った回の E2E は、trace を取って捨てる分だけ遅くなる。変更の前後の所要時間は #123 のコメントに残す。
- `test-results/` は git で無視されている前提を保つ。
