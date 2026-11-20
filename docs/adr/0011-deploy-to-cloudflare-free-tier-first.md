---
type: ADR
title: "ADR-0011: デプロイ先は Cloudflare とし、無料枠に収めることを前提にする"
description: "本番の配置先は Cloudflare（Workers と R2 を軸にする）とし、費用をかけない。企画書の Vercel・Neon の案は採らない。コードはマイルストーン 1 から Workers の実行環境の制約を守る。"
tags: [hosting, cloudflare, cost]
status: stable
---

# ADR-0011: デプロイ先は Cloudflare とし、無料枠に収めることを前提にする

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（Cloudflare を前提にする、費用をかけない）。マイルストーン 1 で実行環境の制約を守ることはエージェント
- 関連: [企画書](../proposal/)、[ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0008](0008-share-one-compose-stack-with-a-slot-per-worktree.md)

## 背景

ユーザーは、デプロイにお金をかけたくないので Cloudflare を前提にすると指定した（2026-11-20）。企画書（2026-11-20 版）の技術構成案は、Vercel・Neon（PostgreSQL）・Cloudflare R2 だった。この案はまだ採用されていない。各サービスの無料枠の具体的な数字は、この ADR を書いた時点では確かめていない。

## 決定

- 本番の配置先は Cloudflare にする。アプリは Workers で動かし、メディアは R2 に置く。
- 有料のプランや、他社の有料サービスを前提にしない。無料枠を超える設計が必要になったら、ADR で判断する。
- データベースを D1 にするか、PostgreSQL と Hyperdrive にするかは、ここでは決めない。マイルストーン 1 の設計の PBI で、無料枠と制約を一次情報で確かめ、別の ADR で決める。
- マイルストーン 1 は引き続きローカルで動かす（[ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)）。ただしコードは最初から Workers の実行環境の制約を守る。native module を使わない。ファイルシステムに書かない。プロセスに状態を持ち続けない。ローカルでは、Cloudflare のサービスの代わりになるもの（R2 の代わりに S3 互換のストレージ、D1 ならローカルの D1）を使う。
- 企画書の Vercel と Neon の案は採らない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Cloudflare（Workers + R2）（採用） | 無料枠で始められる。R2 と同じ場所にまとまる | Node.js の API の一部と native module が使えない。フレームワークのアダプタが要る |
| Vercel + Neon + R2（企画書の案） | Next.js と相性が良い | サービスが 3 社に分かれる。無料枠を超えると費用が出る |
| VPS を自分で運用する | 何でも動く | 月額の費用がかかる。運用の手間 |

## 結果

- フレームワーク・ORM・認証のライブラリは、Workers で動くことを条件に選ぶ。
- code-reviewer は、Workers で動かないコードを指摘する。
- デプロイの作業（アカウント・シークレット）はユーザーの操作が要るので、後のマイルストーンで行う。
