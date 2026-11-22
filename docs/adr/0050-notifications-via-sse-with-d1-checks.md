---
type: ADR
title: "ADR-0050: 通知は SSE で画面へ押し出し、サーバーは 3 秒ごとに D1 を確認する（Durable Objects は使わない）"
description: 通知の 5 秒以内の配信を、Worker の Route Handler が返す SSE（60 秒で閉じ、3 秒ごとに D1 の最新の通知 1 行を確認）で行う。4 条件 × 3 方式の合否と無料枠の使用量の見積りつき。
tags: [architecture, notification, cloudflare]
status: stable
---

# ADR-0050: 通知は SSE で画面へ押し出し、サーバーは 3 秒ごとに D1 を確認する（Durable Objects は使わない）

- ステータス: 採用
- 日付: 2026-11-22
- 決定者: Director（#58 の実装方針で決め、この文書に書いた）
- 関連: [ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0014](0014-code-in-feature-slices.md)、[ADR-0049](0049-scheduled-jobs-run-from-cron-trigger-in-a-custom-worker-entry.md)、[ADR-0053](0053-slice-may-add-ui-entry-to-keep-components-out-of-index.md)、#58、[調査](../research/notification-realtime.md)

## 背景

- 通知の未読数は #50 で 10 秒のポーリングになっており、最悪 10 秒以上遅れる。企画書は「通知が 5 秒以内に画面へ届く」ことを Phase 2 の完了の条件にしている。
- 無料枠（2026-11-22 に確認、URL は[調査](../research/notification-realtime.md)）: Workers Free は 1 日 100,000 リクエスト、CPU 時間 10 ms、HTTP の Worker の実行時間に上限なし。D1 Free は読む行 5,000,000 / 日、書く行 100,000 / 日、1 回の実行で出せる問い合わせ 50。Durable Objects Free は 100,000 リクエスト / 日、13,000 GB-s / 日。
- 利用の想定は 30 人 × 8 時間。M1 はローカルの `pnpm start` と `getPlatformProxy` の結合テストで動く必要がある（[ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)）。

## 決定

通知の 5 秒以内の配信は、Worker の Route Handler `GET /api/notifications/stream` が返す SSE で行う。1 本の接続は 60 秒で閉じ、`retry: 1000` でブラウザの `EventSource` に再接続させる。接続中は 3 秒ごとに D1 で受信者の最新の通知 1 行（`notifications_recipient_created_id_idx`）だけを見て、変わったときだけ未読数（上限 100、`notifications_recipient_unread_idx`）を数えて送る。サーバーの側に購読の状態は持たない（1 本の応答の中の変数だけ）。Durable Objects・3 秒のポーリング・外部サービスは使わない。つながらない間は #50 の 10 秒のポーリングが動く。

選定の規則: 次の 4 条件を全て満たす方式のうち、①ポーリング → ②SSE → ③Durable Objects の順で最初のものを選ぶ。

- 条件 1: いいねから画面までの p95 ≤ 5,000 ms
- 条件 2: 30 人 × 8 時間の 1 日の使用量が、該当する無料枠の 50% 以下
- 条件 3: Workers の制約（native module・ファイルへの書き込み・プロセスの状態なし）を満たし、ローカル（`pnpm start` と `getPlatformProxy` の結合テスト）で動く
- 条件 4: 切断から 5,000 ms 以内に取りこぼしなく戻る

| 方式 | 条件 1 | 条件 2 | 条件 3 | 条件 4 |
|---|---|---|---|---|
| ① 3 秒のポーリング | ✓（式 最大 3.3 秒） | ✗ `30 × 8 × 3600 / 3 = 288,000` リクエスト / 日 = Workers 無料枠の 288% | ✓ | ✓ |
| ② SSE | ✓ 実測 p95 2,946 ms（30 回。確認 3 秒 ＋ 再接続 1 秒の式でも 4 秒前後） | ✓ 接続 `30 × 8 × 60 = 14,400` = 14.4%。D1 の読む行は確認 `288,000` ＋ 接続時の数え直し最大 `14,400 × 100 = 1,440,000` ＝ 最大 1,728,000 行 / 日 = 34.6% | ✓ 応答の中の変数だけ。D1 だけを使い、新しい束縛も `wrangler.jsonc` の変更も無い | ✓ 再接続のたびに最初のイベントで現在の数を送る |
| ③ Durable Objects | ✓（式 数百 ms） | 休止できる API なら ✓（通知 10,000 件 / 日でも 10%）。休止できない作りは ✗（`30 × 8 × 3600 × 0.125 = 108,000` GB-s = 831%） | ✗ ローカルの結合テストに別の Worker（`script_name`）が要り、#56 の自前の Worker・`wrangler.jsonc`（ADR-0049）に DO のクラスと migration を足す必要がある | ✓ |

①は条件 2 で落ちる。②は 4 条件とも満たす。③は②が先に全てを満たすので選ばない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| ① 3 秒のポーリング | 実装が最も単純。接続を持たない | 288,000 リクエスト / 日で無料枠の 288%（条件 2 に落ちる） |
| ② SSE ＋ D1 を 3 秒ごとに確認（採用） | 14.4% と 34.6% で無料枠に余裕。新しい束縛も Worker も不要。いいね・コメント・フォローの処理を変えない。DM（#60）が同じ作りを使える | 配信は最大 3 秒＋問い合わせ。別のタブで既読にした数は、最新の行が変わらないので次の接続（最長 60 秒）で直る。D1 の問い合わせが接続ごとに最大 44 回 |
| ③ Durable Objects の WebSocket | 押し出しなので遅延が最も小さい | 別の Worker・migration・`wrangler.jsonc` の変更が要り、ローカルの結合テストが重くなる。通知を作る 3 つの処理が DO を呼ぶ。休止しない作りは無料枠の 831% |
| 外部サービス（Ably など） | 実装が軽い | 有料の外部サービスを足さない方針（ADR-0011）に反する |

## 結果

- 5 秒以内の配信が、新しい束縛・テーブル・migration なしで満たされる。画面側は `EventSource` が 1 本、サーバー側は 1 本の応答の中の変数だけ。`publishNotification` と like・comment・follow の処理は変えない。
- 受け入れるコスト:
  - 1 本の接続の CPU 時間は確認 20 回 ＋ 印 4 回で、Workers Free の 10 ms に収まる見込み。M2 の配備（#8 配下）で `wrangler tail` の `cpuTime` を確かめ、超えるなら `STREAM_WINDOW_MS` を縮める（接続の数は増えるが、60 秒 → 30 秒でも 28.8% で条件 2 を満たす）。
  - 1 本の接続の D1 の問い合わせは「接続時 2 ＋ 確認 `windowMs / tickMs` 回 × 最大 2 ＋ セッション最大 2」で、既定は最大 44 回。D1 Free の 50 回 / 実行に収まる。`windowMs / tickMs` を増やすときはこの式で 50 を超えないこと。超えると問い合わせが失敗し、応答が閉じて画面が再接続する。
  - 別のタブで既読にした数は、次の接続（最長 60 秒）で直る。
  - 接続ごとの回数制限は付けない（`rate_limits` への書き込みが 1 日 14,400 行で、D1 の書く行の無料枠の 14% を使うため）。
- 守ること:
  - 入力に利用者を指定する項目を持たない。接続が受け取るのはセッションの利用者宛ての数だけ。
  - 問い合わせが失敗したらイベントを送らずに閉じ、ログは `logUnexpected` の名前だけにする。
  - `model/sse.ts` は DM のリアルタイム配信（#60）が再利用する。
  - つながらない間は #50 の 10 秒のポーリングを残す。
  - 経路 `GET /api/notifications/stream` の入口は、ADR-0053 の `ui/index.ts`（ルートが import する入口）に置く。他の slice が import する `index.ts` に置くと、サーバー専用のコードがブラウザの import の連鎖に入って build が落ちる。
