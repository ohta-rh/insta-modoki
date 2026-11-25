---
type: Research
title: 通知を 5 秒以内に画面へ届ける方式の調査（3 秒のポーリング・SSE・Durable Objects）
description: 通知の配信の 3 方式を、無料枠の上限・実行環境の制約・遅延・30 人 × 8 時間の 1 日の使用量で比べた記録。SSE の遅延は 30 回の実測。2026-11-22 時点（#58）。
tags: [research, notification, sse, cloudflare]
status: stable
---

# 通知を 5 秒以内に画面へ届ける方式の調査

2026-11-22 の調査（#58 AC-1・AC-12）。結論は [ADR-0050](../adr/0050-notifications-via-sse-with-d1-checks.md)。企画書の Phase 2 の完了の条件（通知が 5 秒以内に画面へ届く）を、Cloudflare の無料枠（[ADR-0011](../adr/0011-deploy-to-cloudflare-free-tier-first.md)）の中で満たす方式を選ぶ。利用の想定は「30 人が 8 時間つなぐ」。

# 一次情報（2026-11-22 に確認）

| 項目 | 数字 | URL |
|---|---|---|
| Workers Free のリクエスト | 1 日 100,000 | https://developers.cloudflare.com/workers/platform/limits/ |
| Workers Free の CPU 時間 | 1 リクエスト 10 ms（`fetch` や D1 の待ち時間は数えない） | 同上 |
| HTTP で起動した Worker の実行時間 | 上限なし（クライアントがつながっている間は応答を流し続けられる） | 同上 |
| D1 Free の読む行 | 1 日 5,000,000 | https://developers.cloudflare.com/d1/platform/pricing/ |
| D1 Free の書く行 | 1 日 100,000 | 同上 |
| D1 Free の 1 回の Worker の実行で出せる問い合わせ | 50（`db.batch()` は 1 回と数える） | https://developers.cloudflare.com/d1/platform/limits/ |
| Durable Objects Free のリクエスト | 1 日 100,000。受け取る WebSocket のメッセージは 20:1 で数える | https://developers.cloudflare.com/durable-objects/platform/pricing/ |
| Durable Objects Free の実行時間 | 1 日 13,000 GB-s。休止できる間は数えない | 同上 |
| OpenNext で DO のクラスを足す方法 | `.open-next/worker.js` を包む自前の Worker を作り `wrangler.jsonc` の `main` を差し替える | https://opennext.js.org/cloudflare/howtos/custom-worker |
| `getPlatformProxy` で DO を使う方法 | 別の Worker に定義したクラスを `script_name` で指す | https://developers.cloudflare.com/workers/wrangler/api/ |

# 3 方式の比較

| | ① 3 秒のポーリング | ② SSE（D1 を 3 秒ごとに見る） | ③ Durable Objects の WebSocket |
|---|---|---|---|
| 該当する無料枠 | Workers のリクエスト 100,000 / 日 | Workers のリクエスト 100,000 / 日、D1 の読む行 5,000,000 / 日、D1 の問い合わせ 50 / 実行 | DO のリクエスト 100,000 / 日、DO の実行時間 13,000 GB-s / 日（Workers のリクエストも使う） |
| 接続を持ち続けられるか | 持たない（毎回 1 リクエスト） | 持てる（HTTP の Worker の実行時間に上限なし。CPU 時間は待ち時間を数えない） | 持てる（DO が WebSocket を持つ。休止できる API を使えば待つ間の時間を数えない） |
| ローカル（`pnpm start`・`getPlatformProxy`） | 動く（Server Action を呼ぶだけ。#50 で動いている） | 動く。`pnpm start` で最初のイベントが 336〜432 ms で届き、結合テストは `getPlatformProxy` の D1 だけで通る | `getPlatformProxy` は別の Worker（`script_name`）が要り、#56 の自前の Worker と `wrangler.jsonc` に DO のクラスと migration を足す必要がある |
| 遅延 | 式: 3,000 ms（間隔）＋ 呼び出し 100〜300 ms ≒ 最大 3.3 秒。実測はしていない | 実測 p95 = 2,946 ms（30 回、中央値 2,929 ms、最大 3,910 ms）。式: 3,000 ms（確認の間隔）＋ 問い合わせ | 式: Worker → DO の呼び出し ＋ WebSocket の送信 ≒ 数百 ms。実測はしていない |
| 取りこぼし（切断から 5 秒以内に戻る） | 起きない（毎回数を取る） | 起きない（再接続 1 秒で、接続のたびに最初のイベントが現在の数を送る） | 再接続のとき DO が持つ状態から数を送り直す実装が要る |
| 1 日の使用量（30 人 × 8 時間） | 下の式 ① | 下の式 ② | 下の式 ③ |

# 1 日の使用量の見積り（30 人 × 8 時間 = 864,000 人秒）

## ① 3 秒のポーリング

- Workers のリクエスト = `30 × 8 × 3600 / 3 = 288,000` / 日 = 無料枠の 288%。**50% を超える**。
- D1 の読む行 = 1 回に 1 行以上（セッション）。最小でも 288,000 行（5.8%）。未読が多いと 1 回に最大 100 行足されるので、最大 `288,000 × 100 = 28,800,000` 行（576%）。
- 間隔を伸ばさない限り満たせない（伸ばすと 5 秒の条件を割る）。

## ② SSE（1 本の接続は 60 秒、確認は 3 秒ごと）

- Workers のリクエスト = 接続 `30 × 8 × 60 = 14,400` / 日 = 14.4%（1 人が 1 時間に 60 本）。
- D1 の読む行:
  - 確認（最新の通知 1 行）= `30 × 8 × 3600 / 3 × 1 = 288,000`
  - 接続時の数え直し（最大 100 行）= `14,400 × 100 = 1,440,000`
  - 合計 最大 `1,728,000` 行 / 日 = 34.6%
  - セッションの確認は接続ごとに最大 2 行として `14,400 × 2 = 28,800`。足しても 1,756,800 行（35.1%）。
- D1 の書く行 = 0（読むだけ）。
- 1 本の接続の D1 の問い合わせ = 接続時 2 ＋ 確認 20 回 × 最大 2（最新の行が毎回変わり、数え直すとき）＋ セッション最大 2 = 最大 44。無料枠の 50 / 実行に収まる（平常は 24 前後）。超えると問い合わせが失敗し、応答が閉じて画面が再接続する（[ADR-0050](../adr/0050-notifications-via-sse-with-d1-checks.md)）。
- CPU 時間 = 確認 20 回 ＋ 印 4 回の合計で 10 ms に収まる見込み（待ち時間は数えない）。本番での確認は M2 の配備の PBI。

## ③ Durable Objects の WebSocket

- 休止できない作りの実行時間 = `30 × 8 × 3600 s × 0.125 GB = 108,000 GB-s` / 日 = 無料枠の 831%。**50% を超える**。
- 休止できる API を使う場合: DO のリクエスト = 接続 `30` ＋ 通知 1 件ごとの呼び出し（公開）。受け取るメッセージは 20:1。通知が 1 日に 10,000 件でも 10,000 / 100,000 = 10%。実行時間は待つ間は数えない。
- ただし、いいね・コメント・フォローの処理が DO を呼ぶ変更、#56 の自前の Worker・`wrangler.jsonc` への DO のクラスと migration の追加、`getPlatformProxy` 用の別の Worker が要る。

# 実測（SSE の遅延）

`PORT=3101 node scripts/perf/notification-latency.mjs`（`pnpm start` のプレビュー。A は `/` を開いたまま、B が A の新しい投稿へ画面でいいねする。B のクリックから A のナビの名前が「通知（未読 N 件）」になるまで。30 回）。

| 回数 | p95 | 中央値 | 最大 | 5,000 ms 超 |
|---|---|---|---|---|
| 30 | 2,946 ms | 2,929 ms | 3,910 ms | 0 回 |

- 中央値が 3,000 ms の少し手前に集まるのは、1 回ごとの周期が確認の間隔 3 秒にほぼ合ってしまうため。確認は接続ごとに 3 秒ごとなので、実際の利用では 0〜3 秒に散らばり、最悪は 3 秒＋問い合わせ。
- `pnpm start` で応答が溜め込まれず、イベントが増えるたびに届くことは、E2E（`いいねから 5 秒以内にバッジが増える`）と、最初のイベントが 1 秒以内に届く確認（`配信は接続から 1 秒以内に最初のイベントを流す`、336〜432 ms）で確かめた。

# 結論

[ADR-0050](../adr/0050-notifications-via-sse-with-d1-checks.md) の選定の規則（4 条件を全て満たす方式のうち、①→②→③ の順で最初のもの）に当てると、① は条件 2（288%）、② は 4 条件とも満たす（p95 2,946 ms、リクエスト 14.4%、D1 の読む行 34.6%）ので、② を選ぶ。
