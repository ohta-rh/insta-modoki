---
type: ADR
title: "ADR-0049: 定期ジョブは Cron Trigger から Worker の入口 src/worker.mjs で起動し、Worker と Node で同じコードを動かす"
description: "定期ジョブは wrangler.jsonc の triggers.crons で起動する。Worker の入口は src/worker.mjs で、OpenNext の fetch をそのまま渡して scheduled を足す。ジョブは src/jobs/ に D1 の束縛の prepare と .ts 付きの import だけで書き、pnpm jobs:run でも同じコードを動かす。HTTP からジョブを起動する本番の入口は作らない。"
tags: [architecture, jobs, cloudflare]
status: stable
---

# ADR-0049: 定期ジョブは Cron Trigger から Worker の入口 src/worker.mjs で起動し、Worker と Node で同じコードを動かす

- ステータス: 採用
- 日付: 2026-11-22
- 決定者: エージェント（委任された判断。#56）
- 関連: [ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0018](0018-nextjs-on-workers-via-opennext.md)、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0041](0041-e2e-setup-writes-go-through-the-app.md)

## 背景

- 期限切れのストーリーの行とファイルを消し、`storage_orphans` を再試行する定期ジョブが要る（#56）。#59（通知の掃除）なども同じ仕組みに載る。
- Workers の定期実行は Cron Triggers（ADR-0011）。`wrangler.jsonc` の `main` は OpenNext の生成物 `.open-next/worker.js` で、その既定の出力は `export default { async fetch(…) }` だけを持つ（`@opennextjs/cloudflare` 1.20.16 の `dist/cli/templates/worker.js`）。`scheduled` を足すには入口を包む必要がある。
- アプリの drizzle のモジュールは拡張子なしで import し合うので Node は読めない（`src/shared/db/seed/seed.ts:8-11`）。seed は D1 の束縛と `.ts` 付きの import で書いた。
- wrangler 4.158.0 の `dev --test-scheduled` は `/__scheduled?cron=<式>` で `scheduled` を呼ぶ（`middleware-scheduled.ts`）。`opennextjs-cloudflare preview` は残りの引数を `wrangler dev` に渡すので、`pnpm start --test-scheduled` で使える。
- 無料枠は 1 回の実行に外部への通信 50・D1 の問い合わせ 50。

## 決定

- 定期ジョブは `wrangler.jsonc` の `triggers.crons`（`0 18 * * *` = 日本時間 03:00 の 1 本）で起動する。
- Worker の入口は `src/worker.mjs`（`main`）にし、`.open-next/worker.js` の `fetch` をそのまま渡して `scheduled` を足す。`scheduled` は `src/jobs/scheduled.ts` の `onScheduled` を `await` し（`waitUntil` にしない。失敗は Cloudflare の実行の記録に残る）、知らない cron の式では何もしない。`.mjs` は `tsconfig.json` の `include` の外なので、ビルド前の `typecheck` が生成物の不在で落ちない。
- ジョブは `src/jobs/` に置き、登録表 `src/jobs/index.ts` に 1 行足す。D1 の束縛の `prepare` と `.ts` 付きの import だけで書き、drizzle の定義は import しない。1 文のバインド変数は 100 以下。Worker と `node scripts/run-job.ts`（`pnpm jobs:run <名前>`）が同じコードを動かす。
- 失敗したジョブはほかのジョブを止めず、名前と例外の名前だけをログに出し、最後に名前だけの例外を投げる（SQL やパスを漏らさない）。
- HTTP からジョブを起動する本番の入口は作らない。ローカルの `/__scheduled` は `--test-scheduled` のときだけ wrangler が足すもので、`wrangler deploy` には無い。E2E はこれを叩いて、定期実行の配線を確かめる。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| ① 秘密の値で守る HTTP の入口を外部の cron から叩く | 入口がアプリの中で済む | 入口と秘密が増え、攻撃面になる。外部の cron も要る |
| ② Durable Object のアラーム | 時刻の精度が高い | 設定とクラスが増え、日次の 1 本には過大 |
| ③ ジョブを drizzle で書き、手動実行は動いているアプリの `/__scheduled` だけにする | 既存のコードを使える | 名前で 1 つを選べず、件数を返せない。Node はアプリのモジュールを読めない |
| ④ Cron Trigger と `src/worker.mjs`、ジョブは D1 の束縛の `prepare` で書く（採用） | 入口が増えない。Worker と Node で同じコード。ローカルでも E2E で通る | `src/worker.mjs` が型の検査の外にある。ジョブが SQL を直接書く |

## 結果

- 日次の削除がローカルでも E2E（`e2e/story-cleanup.spec.ts`）で通る。
- `src/worker.mjs` は型の検査の外にあるので 5 行の薄さを保つ。#58 が Durable Object を選んだときは、そのクラスの export をこのファイルに足す。
- ジョブを足す PBI は登録表に 1 行足し、上の書き方に従う。1 回の実行が 50 の通信・問い合わせに収まる上限を自分で決める。
- `pnpm jobs:run` はアプリと同じ SQLite のファイルに書くので、アプリが書いている最中は SQLITE_BUSY で失敗しうる（ADR-0041）。そのときはもう一度実行する。
- 本番での Cron Trigger の登録は M2 の `wrangler deploy` が `triggers.crons` から行う。
