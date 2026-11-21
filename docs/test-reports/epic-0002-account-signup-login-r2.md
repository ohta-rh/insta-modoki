---
type: TestReport
title: EPIC #2 アカウント（サインアップ・ログイン・ログアウト）の総合試験（2 回目）
description: ADR-0048 によるやり直し。7e81030 で、リファクタ（52a1ddb..836c2e6）の後も EPIC #2 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。ログアウト後の古いセッションは残らず、失敗の文言も 1 回目と同じ。全て PASS。
tags: [epic-test]
---

# EPIC #2 アカウントの総合試験（2 回目）

## 対象

- EPIC: [#2](https://github.com/ohta-rh/insta-modoki/issues/2)（子 PBI #26 サインアップ・#31 ログイン／ログアウト・#73）
- 試験した commit: `7e81030`（`epic-test/2` の HEAD。統合ブランチの先頭と同じ）
- やり直しの理由: [ADR-0048](../adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)。1 回目（[epic-0002-account-signup-login.md](epic-0002-account-signup-login.md)、379a2fb）の後に、挙動を変えないリファクタ `52a1ddb..836c2e6` が入った。この EPIC の画面の裏にある Server Action の失敗の包み（`src/shared/action.ts`）と、React の `cache` で 1 回の描画の中だけ覚える `getSessionUser`（`src/features/auth/api/session-user.ts`）が変わっている。そのため、ログイン・ログアウト・セッションの状態が画面をまたいで古くならないことと、失敗した操作の文言を重点的に見た。
- 日付: 2026-11-22
- スロット: 1（アプリ `http://localhost:3101`、`pnpm build` → `PORT=3101 pnpm start`、空のスロットから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を操作した。幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。データは全て UI から作り、パスワードは実行時に生成してどこにも書いていない。
- 項目ごとのデータ: [summary.json](evidence/epic-0002-r2/summary.json)

## 結果

PASS。5 つの AC が全て満たされた。ログアウト後に古いセッションが残る例は無く、見つけた問題は無い。AC-4 の `Secure` は 1 回目と同じく ADR-0030 により https のときだけで、http では付かない（結合テストで確認済み。回帰の verify でも通った）。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | `/accounts/signup` を開く。形式の違うメールと 8 字未満のパスワードで送る。正しい入力でサインアップする。サインアップ済みで再び `/accounts/signup` を開く。別の画面で、使われているユーザー名（大文字にした形）を入れて表示名へ移る。使われているメールで送る | PASS。不正な入力は「入力を確認してください」と「メールアドレスの形式を確認してください」「パスワードは 8〜72 字で入力してください」。サインアップで `/` に移りログイン済み（メインのナビが出る）。ログイン済みで `/accounts/signup` を開くと `/` に戻る。ユーザー名の重複は送信の前に「このユーザー名は使われています」が出て、ボタンは無効のまま（URL は変わらない）。直すと表示が消えてボタンが有効に戻る。使われているメールは「入力を確認してください」と「このメールアドレスは登録済みです」 | 空の画面 [1280](evidence/epic-0002-r2/ac1-signup-empty-1280.png)・[768](evidence/epic-0002-r2/ac1-signup-empty-768.png)・[375](evidence/epic-0002-r2/ac1-signup-empty-375.png)、不正な入力 [1280](evidence/epic-0002-r2/ac1-signup-badinput-1280.png)・[768](evidence/epic-0002-r2/ac1-signup-badinput-768.png)・[375](evidence/epic-0002-r2/ac1-signup-badinput-375.png)、サインアップ後の `/` [1280](evidence/epic-0002-r2/ac1-signup-home-1280.png)・[768](evidence/epic-0002-r2/ac1-signup-home-768.png)・[375](evidence/epic-0002-r2/ac1-signup-home-375.png)、ユーザー名の重複 [1280](evidence/epic-0002-r2/ac1-duplicate-username-1280.png)・[768](evidence/epic-0002-r2/ac1-duplicate-username-768.png)・[375](evidence/epic-0002-r2/ac1-duplicate-username-375.png)、メールの重複 [1280](evidence/epic-0002-r2/ac1-duplicate-email-1280.png)・[768](evidence/epic-0002-r2/ac1-duplicate-email-768.png)・[375](evidence/epic-0002-r2/ac1-duplicate-email-375.png) |
| AC-2 | 2 つ目のタブで `/` を開いておく。1 つ目のタブで `/accounts/logout` からログアウトし、`/`・`/create` を開く。戻る・進む、新しく `/` を開く、2 つ目のタブの再読み込みで古いセッションを探す。間違ったパスワードを 1 回送る。同じメールとパスワードでログインする。もう一度ログアウトする | PASS。ログアウトでセッションの Cookie が消え `/accounts/login` に移る。`/`・`/create` は `/accounts/login` に移りナビは出ない。戻る 2 回・進む・`/` の再取得のどれでも、ログイン済みの画面は出ない。2 つ目のタブの再読み込みも `/accounts/login`（古いセッションは残らない）。間違ったパスワードは「メールアドレスまたはパスワードが違います」。正しい組み合わせで `/` に戻り、ナビが出て Cookie が付く。2 回目のログアウトも `/accounts/login` に移る | ログアウト確認 [1280](evidence/epic-0002-r2/ac2-logout-confirm-1280.png)・[768](evidence/epic-0002-r2/ac2-logout-confirm-768.png)・[375](evidence/epic-0002-r2/ac2-logout-confirm-375.png)、ログアウト後 [1280](evidence/epic-0002-r2/ac2-after-logout-login-1280.png)・[768](evidence/epic-0002-r2/ac2-after-logout-login-768.png)・[375](evidence/epic-0002-r2/ac2-after-logout-login-375.png)、`/` → ログイン [1280](evidence/epic-0002-r2/ac2-logged-out-home-1280.png)・[768](evidence/epic-0002-r2/ac2-logged-out-home-768.png)・[375](evidence/epic-0002-r2/ac2-logged-out-home-375.png)、`/create` → ログイン [1280](evidence/epic-0002-r2/ac2-logged-out-create-1280.png)・[768](evidence/epic-0002-r2/ac2-logged-out-create-768.png)・[375](evidence/epic-0002-r2/ac2-logged-out-create-375.png)、2 つ目のタブ（ログアウト後に再読み込み）[1280](evidence/epic-0002-r2/ac2-tab2-after-logout-1280.png)・[768](evidence/epic-0002-r2/ac2-tab2-after-logout-768.png)・[375](evidence/epic-0002-r2/ac2-tab2-after-logout-375.png)、誤りのパスワード [1280](evidence/epic-0002-r2/ac2-login-wrong-1280.png)・[768](evidence/epic-0002-r2/ac2-login-wrong-768.png)・[375](evidence/epic-0002-r2/ac2-login-wrong-375.png)、再ログイン後 [1280](evidence/epic-0002-r2/ac2-relogin-home-1280.png)・[768](evidence/epic-0002-r2/ac2-relogin-home-768.png)・[375](evidence/epic-0002-r2/ac2-relogin-home-375.png) |
| AC-3 | 分の境目の直後（UTC の秒が 0〜1）から、専用の `cf-connecting-ip` で、登録済みのメールに間違ったパスワードを 6 回送る。同じ手順で未登録のメールも | PASS。登録済み（23:44:00.005〜23:44:02.884 UTC）も未登録（23:45:00.039〜23:45:02.909 UTC）も、1〜5 回目は「メールアドレスまたはパスワードが違います」、6 回目は「操作が多すぎます。しばらくしてからもう一度お試しください」。2 つの場合で文言は同じ。窓の跨ぎは無い | 登録済み 5 回目 [1280](evidence/epic-0002-r2/ac3-registered-attempt5-1280.png)・[768](evidence/epic-0002-r2/ac3-registered-attempt5-768.png)・[375](evidence/epic-0002-r2/ac3-registered-attempt5-375.png)、6 回目 [1280](evidence/epic-0002-r2/ac3-registered-attempt6-1280.png)・[768](evidence/epic-0002-r2/ac3-registered-attempt6-768.png)・[375](evidence/epic-0002-r2/ac3-registered-attempt6-375.png)、未登録 5 回目 [1280](evidence/epic-0002-r2/ac3-unregistered-attempt5-1280.png)・[768](evidence/epic-0002-r2/ac3-unregistered-attempt5-768.png)・[375](evidence/epic-0002-r2/ac3-unregistered-attempt5-375.png)、6 回目 [1280](evidence/epic-0002-r2/ac3-unregistered-attempt6-1280.png)・[768](evidence/epic-0002-r2/ac3-unregistered-attempt6-768.png)・[375](evidence/epic-0002-r2/ac3-unregistered-attempt6-375.png) |
| AC-4 | サインアップ直後に `context.cookies()` で属性を読む（値は記録しない）。`document.cookie` からの見え方も確かめる | PASS（1 回目と同じ判定）。`better-auth.session_token`、`HttpOnly: true`、`SameSite: Lax`、`Path: /`、30 日。`Secure: false` で `__Secure-` の接頭辞なし（http のため。ADR-0030 は https のときだけ付けると決めている）。`document.cookie` からは見えない。https での付与は `sign-up.int.test.ts`・`session-cookie.test.ts`・`log-out.int.test.ts` が確かめる（下の回帰の verify で通った） | [Cookie の属性の表 1280](evidence/epic-0002-r2/ac4-cookie-attrs-1280.png)（`context.cookies()` の値を表にして撮った写真） |
| AC-5 | サインアップ・ログアウト確認・ログインの 3 画面を、375px と 1280px で、Tab・文字入力・Enter だけで操作した | PASS。3 画面とも両方の幅で最後まで操作できた（サインアップ → `/`、ログアウト確認 → `/accounts/login`、ログイン → `/`）。横のスクロールは無い。コンソールのエラー・警告と失敗した通信は 0 | サインアップ [1280](evidence/epic-0002-r2/ac5-signup-keyboard-1280.png)・[375](evidence/epic-0002-r2/ac5-signup-keyboard-375.png)、ログアウト確認 [1280](evidence/epic-0002-r2/ac5-logout-keyboard-1280.png)・[375](evidence/epic-0002-r2/ac5-logout-keyboard-375.png)、ログイン [1280](evidence/epic-0002-r2/ac5-login-keyboard-1280.png)・[375](evidence/epic-0002-r2/ac5-login-keyboard-375.png) |

### AC-5 の Tab の順（[summary.json](evidence/epic-0002-r2/summary.json) の `keyboard`）

画面の本文をクリックして焦点を外した所から Tab を押したため、先頭の「本文へ移動」は最後（1 周して戻る手前）に出る。

| 画面 | 1280px | 375px |
|---|---|---|
| サインアップ | メールアドレス → ユーザー名 → 表示名 → パスワード → サインアップ（ボタン）→ 本文へ移動 → 先頭に戻る | 同じ |
| ログアウト確認 | ホーム・検索・投稿・通知・プロフィール（左のナビ）→ ログアウト（ボタン）→ 本文へ移動 → 先頭に戻る | ログアウト（ボタン）→ ホーム・検索・投稿・通知・プロフィール（下のナビ）→ 本文へ移動 → 先頭に戻る |
| ログイン | メールアドレス → パスワード → ログイン（ボタン）→ サインアップ（リンク）→ 本文へ移動 → 先頭に戻る | 同じ |

## ブラウザの状態

全ての画面と手順を通して、コンソールのエラー・警告・`pageerror`・`requestfailed`・状態 400 以上の応答を数えた。全て 0（[summary.json](evidence/epic-0002-r2/summary.json) の `events` が空）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（空・不正な入力・成功・重複したユーザー名・重複したメール） | 0 | 0 |
| `/`（サインアップ直後・再ログイン後・2 つ目のタブ） | 0 | 0 |
| ログアウト確認 | 0 | 0 |
| ログイン（ログアウト後・誤りのパスワード・6 回の試行・`/`・`/create` からの移動・戻る／進む） | 0 | 0 |
| キーボードだけの 3 画面（375・1280px） | 0 | 0 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3101 node scripts/verify.mjs`（スロット 1） | 0 |
| 子 PBI の E2E（`e2e/signup.spec.ts`・`e2e/login-logout.spec.ts`）を含む e2e の手順 | 0（verify の中。139 件が通った） |

verify は typecheck・lint・format・docs・unit・integration・build・e2e・perf-budget が全て OK（初期 JS 150,792 バイト、上限 170,000）。ログ: [verify.txt](evidence/epic-0002-r2/verify.txt)。アプリのサーバーは止めてから実行した。

## 見つけた問題

なし。

補足（問題ではない）: AC-4 の `Secure` は、ローカルが http であることで付かない。決定どおり。
