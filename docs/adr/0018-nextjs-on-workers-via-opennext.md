---
type: ADR
title: "ADR-0018: アプリは Next.js 16（App Router）を OpenNext で Cloudflare Workers に載せて動かす"
description: "フレームワークは Next.js 16 の App Router、Workers へは @opennextjs/cloudflare、ローカルの実行環境は workerd（wrangler）にする。React Router と TanStack Start は退ける。ADR-0014 の slice の構成とは矛盾しない。"
tags: [architecture, framework, cloudflare]
status: stable
---

# ADR-0018: アプリは Next.js 16（App Router）を OpenNext で Cloudflare Workers に載せて動かす

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [調査](../research/stack-selection.md)、#18、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0014](0014-code-in-feature-slices.md)、[ADR-0016](0016-typescript-and-react.md)

## 背景

デプロイ先は Cloudflare の無料枠で、native module・ファイルへの書き込み・プロセスの状態を使えない（ADR-0011）。言語は TypeScript、UI は React（ADR-0016）。Workers の無料のプランは、1 リクエストの CPU 時間が 10 ms、1 日のリクエストが 100,000、スクリプトの大きさが展開後 64 MiB（OpenNext の文書は圧縮後 3 MiB と書く）。選ぶ順序は ① workerd で動く ② 無料枠に収まる ③ ADR-0014 を壊さない ④ 企画書の第一案に近い。

試作（調査の「試作の記録」）で、Next.js 16.4.5 + @opennextjs/cloudflare 1.20.16 + wrangler 4.158.0 が workerd で動き、ルートハンドラー・Drizzle・Better Auth・`proxy.ts`・静的ファイルのヘッダーが通り、ビルドの成果物は gzip 後 1,713 KiB（`wrangler deploy --dry-run`）だった。

## 決定

- フレームワークは Next.js 16（App Router）にする。React Router と TanStack Start は使わない。
- Workers への載せ方は `@opennextjs/cloudflare`（OpenNext）にする。`wrangler.jsonc` は `main: ".open-next/worker.js"`・`compatibility_flags: ["nodejs_compat"]`・`assets`・D1 のバインディングを持つ。
- ローカルの実行環境は workerd（`opennextjs-cloudflare preview`）。開発の速さのための `next dev` は `initOpenNextCloudflareForDev()` でバインディングを使う。
- ルートのファイルは `src/app/` に置き、薄く保って `src/features/<slice>/` を組み合わせるだけにする。ミドルウェアは `src/proxy.ts`（Node.js ランタイム）。
- 版は、確認日の 2 週間以上前に公開された安定版を固定する（next 16.4.5、@opennextjs/cloudflare 1.20.16、wrangler 4.158.0）。
- Cloudflare が新規の Next.js に勧める vinext は、まだ試していない。OpenNext で支障が出たときの移行先の候補として残す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Next.js を OpenNext で載せる（採用） | 試作が workerd で動いた。企画書の第一案。Server Actions・Route Handlers・`proxy.ts` が使える。gzip 後 1.67 MiB | Node.js ミドルウェアは実験的。動的な画面の CPU 時間が 8 ms で 10 ms に近い。Cloudflare は新規には vinext を勧める |
| React Router（framework mode） | Cloudflare の Vite プラグインで workerd 上で動く。構成が軽い | この PBI では試作していない。SPA モードが使えない。企画書の第一案から外れる |
| TanStack Start | 安定と明記されている。Cloudflare の Vite プラグインで動く | この PBI では試作していない。企画書の第一案から外れ、知見が少ない |
| vinext（参考） | Cloudflare が新規の Next.js に勧める | 試作していない。OpenNext の代わりとしての成熟度を確かめていない |

## 結果

- [ADR-0014](0014-code-in-feature-slices.md) は置き換えない。Next.js は `src/app/` 以外のディレクトリに規約を課さず、`src/features/` と `src/shared/` はそのまま使える。ルートのファイルは薄く保つ、という ADR-0014 の決定は `src/app/` のファイルに当てはまる。
- ルートのファイルの場所と、コマンド名・環境変数・後続の PBI の確定表は [overview.md](../architecture/overview.md) に書く。
- M2 のデプロイで、動的な画面の CPU 時間とスクリプトの大きさを実測する。上限を超えるなら、無料枠の方針の見直しになるので、ユーザーの判断に回す。
- code-reviewer は、Workers で動かない API（`fs` への書き込み、native module、プロセスの状態）を指摘する。
