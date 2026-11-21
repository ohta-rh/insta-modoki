---
okf_version: "0.3"
title: insta-modoki のドキュメント
description: 写真共有 SNS の UX を独自ブランドで再現する Web アプリの企画・決定・設計の記録。プロジェクトの方針や判断の理由を知りたいときに読む。
---

# insta-modoki のドキュメント

写真共有 SNS（Instagram）の UX と機能を、独自のブランドで忠実に再現する Web アプリの記録。書き方の決まりは [ADR-0002](adr/0002-docs-as-okf-v0-3-bundle.md)。

# 最初に読むもの

* [企画書](proposal/) - 目的・機能の優先度・画面・データモデル・ロードマップ（PDF と HTML の原本）
* [Architecture Decision Records](adr/) - 決定とその理由の一覧

# ディレクトリ

* [proposal/](proposal/) - 企画書
* [architecture/](architecture/) - データモデル・URL とサーバーの処理・実装の共通の決まり
* [adr/](adr/) - 決定とその理由
* [test-reports/](test-reports/) - EPIC の総合試験のレポートとエビデンス

# 履歴

* [log.md](log.md) - ドキュメントの追加と変更の履歴

# type の一覧

* `ADR` - 1 つの決定とその理由（`adr/`）
* `Template` - 写して使うひな形
* `Proposal` - 企画・提案
* `Architecture` - 今のシステムの構造
* `Guide` - 動かし方・運用の手順
* `Research` - ある日付の時点の調査の結果
* `Requirements` - ID の付いた要件
* `TestReport` - 1 つの作業で確かめたことの記録
