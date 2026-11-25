---
type: ADR
title: "ADR-0013: 企画書のロードマップを 4 つのマイルストーン（ローカルの MVP → Cloudflare で公開 → Phase 2 → Phase 3）に組み直す"
description: "企画書の M0〜M3 を、ADR-0006 と ADR-0011 に合わせて M1 ローカルの MVP、M2 Cloudflare での招待制公開、M3 Phase 2、M4 Phase 3 と成功指標の計測、に組み直す。"
tags: [planning, milestone]
status: deprecated
superseded_by: 0052-phase-2-before-cloudflare-publication.md
---

# ADR-0013: 企画書のロードマップを 4 つのマイルストーン（ローカルの MVP → Cloudflare で公開 → Phase 2 → Phase 3）に組み直す

- ステータス: 置き換え: [ADR-0052](0052-phase-2-before-cloudflare-publication.md)（順番と期日。中身はそのまま引き継ぐ）
- 日付: 2026-11-20
- 決定者: エージェント（委任された判断。ユーザーは企画書からマイルストーン・EPIC・PBI を作るよう指示した）
- 関連: [企画書](../proposal/)、[ADR-0004](0004-milestone-epic-pbi-with-dor-ac-dod.md)、[ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)

## 背景

企画書（2026-11-20 版、11 ページ）のロードマップには、4 つのマイルストーンがある。

- M0（2026-12-06）: 空のアプリを本番 URL で表示する
- M1（2027-02-14）: MVP を招待制で公開する
- M2（2027-03-28）: Phase 2 を完了する
- M3（2027-05-09）: Phase 3 を完了し、公開する

一方、ADR-0006 は、最初のマイルストーンをローカルの docker compose で動かすと決めている。ADR-0011 は、デプロイ先を Cloudflare とし、企画書の Vercel・Neon の案を採らないと決めている。企画書の M0 は、本番 URL とクラウドのアカウントを前提にしているので、この 2 つの ADR と合わない。

## 決定

GitHub の Milestone を、次の 4 つにする。

| Milestone | 中身 | 期日 |
|---|---|---|
| M1: MVP がローカルで動く | 企画書の Phase 0（基盤）と MVP の 8 機能。品質の基準（性能・アクセシビリティ）を含む | 2027-02-14 |
| M2: Cloudflare に招待制デモとして公開 | 名称の確定、Cloudflare のリソース、デプロイの自動化、招待制、GitHub OAuth、管理者による削除、本番のデモデータ | 2027-02-28 |
| M3: Phase 2 | ストーリー・発見・通知・保存 | 2027-04-11 |
| M4: Phase 3 と成功指標 | DM・安全・PWA・縦型動画（任意）・成功指標の計測・紹介ページ | 2027-05-09 |

- GitHub OAuth は、OAuth アプリの資格情報がユーザーにしか作れないので、M1 から M2 に移す。
- ユーザーにしかできない作業を含む PBI（名称の承認、Cloudflare のアカウント、OAuth アプリ）には `blocked` のラベルを付ける。
- M3 と M4 の PBI は、M1 の最後の PBI（アクセシビリティ）の後に始める。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 4 つに組み直す（採用） | ADR-0006 と ADR-0011 に合う。M1 をユーザーの操作なしで完了できる | 招待制での公開が企画書より 2 週間遅れる |
| 企画書の M0〜M3 のまま | 企画書と一致する | M0 がクラウドのアカウント待ちで止まる。ADR-0006 と矛盾する |
| M1 にデプロイまで含める | マイルストーンの数が減る | ユーザーの操作待ちの PBI が M1 に混ざり、M1 が閉じられない |

## 結果

- M1 は、ユーザーの操作を待たずに最後まで進められる。
- 企画書の期日は目安のまま使う。遅れたときは、企画書のとおり機能 16 → 15 → 14 の順に見送る。
- 企画書の機能番号は GitHub の issue 番号と紛らわしいので、issue では「#N」と書かず「機能 N」と書く。
- 起票した Milestone・EPIC・PBI: M1〜M4、EPIC #1〜#17、PBI #18〜#68（2026-11-20）。
