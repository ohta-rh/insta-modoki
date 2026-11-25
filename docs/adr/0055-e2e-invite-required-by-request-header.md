---
type: ADR
title: "ADR-0055: E2E のサーバーは招待コードを必須にせず、E2E 専用のリクエストヘッダーで、そのリクエストだけ必須にする"
description: "招待コードの必須（INVITE_REQUIRED=true）は環境変数で、M1 の既定は必須でない。E2E のサーバーは 1 つで、全ての spec のサインアップがコード無しで通る。招待のシナリオ（#38）だけが必須の環境を要るので、E2E_HARNESS=1 かつ APP_ENV が local か test のサーバーに限り、ヘッダー x-e2e-invite-required: true を付けたリクエストを必須として扱う。"
tags: [testing, e2e, auth]
status: stable
---

# ADR-0055: E2E のサーバーは招待コードを必須にせず、E2E 専用のリクエストヘッダーで、そのリクエストだけ必須にする

- ステータス: 採用
- 日付: 2026-11-23
- 決定者: エージェント（委任された判断）。Director が採番
- 関連: [ADR-0041](0041-e2e-setup-writes-go-through-the-app.md)、#38

## 背景

`signUp` は `INVITE_REQUIRED` が `true` のときだけ招待コードを必須にする（既定は未設定 = 必須でない。#38 の AC-10）。E2E のサーバーは `playwright.config.ts` の 1 つで、`--var` で渡した値は全ての spec に効く。ほとんどの spec（`signUpViaUi`、`fillSignUp`、キーボードだけのサインアップ）はコード無しでサインアップするので、サーバーを必須にすると既存の spec が全て変わってしまう。一方 AC-12・AC-13 は「招待コードが必須の環境」の画面を調べる。

## 決定

- `isInviteRequired(env, headers)`（`src/features/auth/api/invite-required.ts`）が、必須かどうかの唯一の判定である。`INVITE_REQUIRED` が文字列の `true` なら必須。
- それに加え、`E2E_HARNESS=1` かつ `APP_ENV` が `local` か `test` のとき（`/e2e-harness/db` と同じ条件。`playwright.config.ts` だけが設定する）に限り、リクエストヘッダー `x-e2e-invite-required: true` を付けたリクエストを必須として扱う。サインアップ画面と `signUp` の両方が `isInviteRequired` を通る。
- 招待のシナリオは `e2e/support/admin.ts` の `inviteOnlyHeaders()` をブラウザのコンテキストに付ける。他の spec は付けない。
- 本番と wrangler の設定には `E2E_HARNESS` を入れないので、ヘッダーは効かない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| リクエストヘッダー（採用） | サーバーは 1 つのまま。既存の spec が変わらない。並列に走る他の spec に影響しない | 本番のコードにテスト用の分岐が 1 つ入る（2 つの環境変数で閉じる） |
| E2E のサーバー全体を `INVITE_REQUIRED:true` にする | コードに分岐が入らない | 既存の spec のサインアップ（`fillSignUp`、キーボード、axe）を全て書き換える。AC-10「既存の E2E が変わらず通る」に反する |
| 招待用にもう 1 つサーバーを起こす | コードに分岐が入らない | 同じ D1 の SQLite のファイルを 2 つのサーバーが書き、SQLITE_BUSY の恐れ（ADR-0041）。ポートもスロットの外に要る |
| ハーネスでサーバーの状態（フラグ）を切り替える | 分岐が 1 つ | 切り替えている間、並列の他の spec のサインアップが落ちる |

## 結果

- 必須の判定が 1 つの関数に集まり、単体テスト（`invite-required.test.ts`）が両方の条件を調べる。
- 守ること: ヘッダーの分岐は `E2E_HARNESS` と `APP_ENV` の両方を見る。`/e2e-harness` の条件を変えるときはこの関数も揃える。
- コストとして、本番の経路に E2E 専用の分岐が 1 つ残る。
