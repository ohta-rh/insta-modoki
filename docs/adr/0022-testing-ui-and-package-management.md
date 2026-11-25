---
type: ADR
title: "ADR-0022: テストは Vitest と Playwright、UI は Tailwind CSS と Radix UI、実行環境は Node.js 26 と pnpm 12 にする"
description: "単体と結合のテストは Vitest 5、E2E は Playwright、UI は Tailwind CSS 4 と Radix UI Primitives、ランタイムは Node.js 26（LTS）、パッケージ管理は pnpm 12、lint と format は ESLint と Prettier。Jest・CSS Modules（主）・npm・bun・Biome は退ける。"
tags: [technology, testing, ui, tooling]
status: stable
---

# ADR-0022: テストは Vitest と Playwright、UI は Tailwind CSS と Radix UI、実行環境は Node.js 26 と pnpm 12 にする

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [調査](../research/stack-selection.md)、#18、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0016](0016-typescript-and-react.md)、[ADR-0018](0018-nextjs-on-workers-via-opennext.md)

## 背景

TDD・E2E・verify の運用（ADR-0009）に使うテストの道具と、UI のスタイル、ランタイム、パッケージ管理を決める。試作は Node.js 26.12.0（調査の時点で LTS）と pnpm 12.18.0 で動いた。pnpm 12 は、依存のビルドスクリプトを承認制にし、承認を `pnpm-workspace.yaml` の `allowBuilds` に書く。Playwright は Node.js 22・24・26 に対応し、Vitest 5 は Node.js 22.12 以上と Vite 6.4 以上を要る。Next.js の文書は「ほとんどのスタイルに Tailwind、足りないときに CSS Modules」を勧める。

## 決定

- 単体と結合のテストは Vitest 5（`*.test.ts(x)`、`*.int.test.ts`）。結合テストの DB は `getPlatformProxy({ persist: false })` のメモリ上の D1。Workers の実行環境そのものの中で動かす必要が出たときは `@cloudflare/vitest-plugin` を足す。
- E2E は Playwright（`e2e/*.spec.ts`）。`webServer` は `opennextjs-cloudflare preview` をスロットのポートで起動する。
- スタイルは Tailwind CSS 4（`tailwindcss`・`@tailwindcss/postcss`・`postcss.config.mjs`・`src/app/globals.css`）。モーダル・メニューなどの部品は Radix UI Primitives。Tailwind で足りないときだけ CSS Modules を使う。
- ランタイムは Node.js 26（LTS）。`.node-version` に `26` と書く。
- パッケージ管理は pnpm 12。`packageManager` に版を固定し、CI は `pnpm install --frozen-lockfile`。`pnpm-workspace.yaml` の `allowBuilds` に、必要な依存（試作では `esbuild` と `workerd`）だけを `true` で書く。
- lint は ESLint 10（`eslint.config.mjs`）、format の確認は Prettier 3（`prettier . --check`）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Vitest + Playwright（採用） | Vite と TypeScript をそのまま扱う。Cloudflare が Workers 用のプラグインを出している。Playwright は Node.js 26 に対応 | Vitest 5 は Node.js 22.12 以上を要る |
| Jest | 広く使われている | TypeScript に Babel か ts-jest が要り、Babel は型を検査しない。文書の例は CommonJS |
| Tailwind CSS + Radix UI（採用） | Next.js の文書の推奨。Radix がフォーカスの管理とキーボード操作を持つ | クラス名が長くなる |
| CSS Modules を主にする | 追加の依存が無い | 部品の振る舞いを自作する。Next.js の文書も Tailwind を先に勧める |
| Node.js 26 + pnpm 12（採用） | 試作が動いた。pnpm は CI で `--frozen-lockfile` が既定 | pnpm 12 の `allowBuilds` の設定が要る |
| npm | Node.js に同梱 | 依存のビルドスクリプトの承認を持たない |
| bun | 実行環境・パッケージ管理・テストが 1 つ | Workers と wrangler の対応が文書に無く、workerd で動かすこのプロジェクトでは使い所が無い |
| ESLint + Prettier（採用） | 文書の手順が確かで、`lint` と `format:check` を分けられる | 設定ファイルが 2 つ |
| Biome | 1 つの道具で lint と format | React と Next.js のルールを文書で確かめられていない |

## 結果

- コマンド名と設定ファイルの名前は [overview.md](../architecture/overview.md) の表に書く。
- #22（CI）は setup-node で Node.js 26、pnpm の版を `packageManager` から読む。
- 依存を足す PBI は、ビルドスクリプトが承認待ちで止まったら `allowBuilds` に足す。
