---
type: ADR
title: "ADR-0016: 言語は TypeScript、UI は React にする（フレームワークは #18 で決める）"
description: "アプリの言語は TypeScript（strict）、UI は React とする。Workers で動くフレームワーク・DB・ORM・認証は引き続き #18 で決める。"
tags: [technology]
status: stable
---

# ADR-0016: 言語は TypeScript、UI は React にする（フレームワークは #18 で決める）

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [企画書](../proposal/)、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0014](0014-code-in-feature-slices.md)、[ADR-0015](0015-pbis-follow-the-global-write-pbi-standard.md)

## 背景

PBI に具体的なファイル名と部品の名前を書くには（ADR-0015）、言語と UI の前提が要る。企画書（2026-11-20 版、9 ページ）の技術構成案は、アプリを Next.js（App Router）と TypeScript とし、代替案を React Router v7 と SvelteKit にしていた。デプロイ先は Cloudflare に決まっている（ADR-0011）。

## 決定

- アプリの言語は TypeScript（`strict`）にする。
- UI は React にし、部品のファイルは `.tsx` にする。
- フレームワーク（Next.js を OpenNext で Workers に載せる、React Router v7 など）、DB、ORM、認証は、#18 で一次情報と試作をもとに決める。SvelteKit は、この ADR で候補から外す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| TypeScript + React（採用） | 企画書の第一案と代替案の大半に合う。Workers で動くフレームワークの選択肢が複数ある | SvelteKit の軽さを諦める |
| 全部を #18 まで決めない | 選択肢が最も広い | PBI に部品とファイルの名前を書けない |
| SvelteKit | 初期の JS が小さい | 企画書の第一案から外れる。React の部品の知見を使えない |

## 結果

- PBI は `.ts` / `.tsx` のファイル名と React の部品の名前で書く。
- #18 で選ぶフレームワークは React の上で Workers に載るものに限られる。
