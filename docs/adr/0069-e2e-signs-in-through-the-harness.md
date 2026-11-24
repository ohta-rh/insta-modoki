---
type: ADR
title: "ADR-0069: E2E は、サインアップを確かめない場面では E2E 用の窓口の seedSession でログイン済みのユーザーを用意する"
description: "E2E の用意の関数は、ユーザーとセッションの行を窓口 /e2e-harness/db の seedSession で作り、返った cookie を context.addCookies で入れる。画面のサインアップは、サインアップ・ログイン・招待・a11y のサインアップ画面を確かめる spec だけが通る。"
tags: [testing, e2e, auth]
status: stable
---

# ADR-0069: E2E は、サインアップを確かめない場面では E2E 用の窓口の seedSession でログイン済みのユーザーを用意する

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。#116）
- 関連: [ADR-0041](0041-e2e-setup-writes-go-through-the-app.md)、[ADR-0049](0049-scheduled-jobs-run-from-cron-trigger-in-a-custom-worker-entry.md)、[ADR-0055](0055-e2e-invite-required-by-request-header.md)

## 背景

- E2E の用意の関数（`e2e/support/auth.ts` の `signUpViaUi`、`test`・`signedIn` の fixture、`e2e/support/screens.ts` の `createWorld`）は、ユーザーとセッションを毎回サインアップの画面の操作で作る。フォームの入力・送信・パスワードの hash・リダイレクトの待ちを、画面を確かめない E2E まで払う。
- 2026-11-24 の pbi-93 の verify（f492309）では、load average が 23〜29 のときに、E2E の最初の 8 件が `sign-up stayed on …/accounts/signup` で時間切れになった。
- E2E 用の窓口 `/e2e-harness/db`（`E2E_HARNESS=1` かつ `APP_ENV` が local か test のときだけ答える）の `seedUser` は、ユーザーの行だけを作り、セッションを作らない。

## 決定

- 窓口に `seedSession` を足す。ユーザー・パスワードの資格情報（今のサインアップと同じ hash）・セッションの行を 1 つの `db.batch` で書き、`{ userId, username, cookie: { name, value } }` を返す。cookie の名前・署名・期限は、今のログインの `newSession` と `sessionSetCookie` が作るものと同じ。
- E2E の用意の関数 `signInViaHarness` は `seedSession` を呼び、返った cookie を `context.addCookies` で入れる。`test`・`signedIn`・`freshUser`・`createWorld` と、サインアップ自体を確かめない spec は、これを使う。
- `signUpViaUi` は残す。サインアップ・ログイン・招待・a11y のサインアップの画面を確かめる spec だけが使い、画面から今と同じくサインアップする。
- 窓口が無効（本番）のときは今と同じく 404 で、行を作らない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 窓口の `seedSession`（採用） | 1 回の HTTP で済み、画面と hash の待ちが無い。cookie が本物のログインと同じなので、アプリの認証をそのまま通る | 窓口に 1 つ操作が増える |
| テストの process から DB に直接書く | 窓口が増えない | 2 つ目の process の書き込みで SQLITE_BUSY になる（[ADR-0041](0041-e2e-setup-writes-go-through-the-app.md)） |
| 1 回サインアップして storageState を使い回す | 窓口が増えない | ユーザーを分けたい場面で使えない。サインアップの画面の負荷が残る |
| 何もしない | 変更なし | 負荷の高いマシンで最初に時間切れになる |

## 結果

- サインアップを確かめない E2E は、サインアップの画面の待ちを払わない。
- 窓口は、cookie を作る代わりに本番と同じ署名の関数を呼ぶので、`BETTER_AUTH_SECRET` を知る窓口が E2E の環境だけに有効であることが、今まで以上に守る点になる（`E2E_HARNESS` と `APP_ENV` の二重の条件は変えない）。
- 今後、サインアップの画面を確かめない E2E は `signUpViaUi` を呼ばず `signInViaHarness` を使う。
