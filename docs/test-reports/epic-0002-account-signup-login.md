---
type: TestReport
title: EPIC #2 アカウント（サインアップ・ログイン・ログアウト）の総合試験（1 回目）
description: 統合ブランチ m1/local-mvp の 379a2fb で、EPIC #2 の 5 つの受け入れ条件を実ブラウザ（Google Chrome 157）で確かめた。5 つとも満たし PASS。AC-4 の Secure は ADR-0030 により https のときだけで、https での付与は結合テストで確かめた（Director の判定）。
tags: [epic-test]
---

# EPIC #2 アカウントの総合試験（1 回目）

## 対象

- EPIC: [#2](https://github.com/ohta-rh/insta-modoki/issues/2)（子 PBI #26 サインアップ・#31 ログイン／ログアウト）
- 試験した commit: `379a2fb`（統合ブランチ `m1/local-mvp`。[ADR-0017](../adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) により `main` の代わり）
- 日付: 2026-11-21
- スロット: 3（アプリ `http://localhost:3103`、`pnpm build` → `PORT=3103 pnpm start`、空のスロットから）
- OS: macOS 26.2
- ブラウザ: Google Chrome 157.0.8103.80（安定版、画面あり）
- 操作の手段: chrome-devtools の MCP は `list_pages` が 2 回とも失敗した（`The browser is already running for .../chrome-devtools-mcp/chrome-profile`。別のセッションが握っている）。そのため [ADR-0045](../adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md) のとおり、Playwright の `channel: 'chrome'`・`headless: false` で起動した使い捨てのプロファイルの Google Chrome を CDP で操作した。表示の幅は `setViewportSize` で 1280（高さ 900）・768（1024）・375（812）。データは全て UI から作った。パスワードは実行時に生成し、どこにも書いていない。
- 項目ごとのデータ: [summary.json](evidence/epic-0002/summary.json)

## 結果

PASS。AC-1・2・3・5 は実ブラウザで満たした。AC-4 は Director の判定で PASS（下の「AC-4 の判定」）。見つけた問題（製品の不具合）は無い。

## 受け入れ条件

| AC | 操作 | 結果 | エビデンス |
|---|---|---|---|
| AC-1 | 未ログインで `/accounts/signup` を開き、メール・ユーザー名・表示名・パスワードを入れてサインアップ。別の画面（Cookie 無し）で、使われているユーザー名を入れて表示名へ移る（ユーザー名の入力欄から離れる） | PASS。サインアップで `/` に移り、ログイン済み（左・下のナビが出る）。重複は送信の前に「このユーザー名は使われています」が出て、サインアップのボタンが無効のまま（URL は `/accounts/signup` のまま）。ユーザー名を直すと表示が消えてボタンが有効に戻る。失敗の経路: 形式の違うメールと 8 字未満のパスワードは「入力を確認してください」と項目ごとの文言、使われているメールの送信は「このメールアドレスは登録済みです」 | [空の画面 1280](evidence/epic-0002/ac1-signup-empty-1280.png)・[768](evidence/epic-0002/ac1-signup-empty-768.png)・[375](evidence/epic-0002/ac1-signup-empty-375.png)、[不正な入力 1280](evidence/epic-0002/ac1-signup-badinput-1280.png)・[768](evidence/epic-0002/ac1-signup-badinput-768.png)・[375](evidence/epic-0002/ac1-signup-badinput-375.png)、[サインアップ後の `/` 1280](evidence/epic-0002/ac1-signup-home-1280.png)・[768](evidence/epic-0002/ac1-signup-home-768.png)・[375](evidence/epic-0002/ac1-signup-home-375.png)、[ユーザー名の重複 1280](evidence/epic-0002/ac1-duplicate-username-1280.png)・[768](evidence/epic-0002/ac1-duplicate-username-768.png)・[375](evidence/epic-0002/ac1-duplicate-username-375.png)、[メールの重複 1280](evidence/epic-0002/ac1-duplicate-email-1280.png)・[768](evidence/epic-0002/ac1-duplicate-email-768.png)・[375](evidence/epic-0002/ac1-duplicate-email-375.png) |
| AC-2 | `/accounts/logout` の確認画面でログアウトし、`/` と `/create` を開く。同じメールとパスワードでログインする。失敗の経路として、間違ったパスワードを 1 回送る | PASS。ログアウト後に Cookie が消え `/accounts/login` に移る。`/`・`/create` はどちらも `/accounts/login` に移る。間違ったパスワードは「メールアドレスまたはパスワードが違います」。正しい組み合わせで `/` に戻り、Cookie が再び付く | [ログアウト確認 1280](evidence/epic-0002/ac2-logout-confirm-1280.png)・[768](evidence/epic-0002/ac2-logout-confirm-768.png)・[375](evidence/epic-0002/ac2-logout-confirm-375.png)、[ログアウト後 1280](evidence/epic-0002/ac2-after-logout-login-1280.png)・[768](evidence/epic-0002/ac2-after-logout-login-768.png)・[375](evidence/epic-0002/ac2-after-logout-login-375.png)、[`/` → ログイン 1280](evidence/epic-0002/ac2-logged-out-home-1280.png)・[768](evidence/epic-0002/ac2-logged-out-home-768.png)・[375](evidence/epic-0002/ac2-logged-out-home-375.png)、[`/create` → ログイン 1280](evidence/epic-0002/ac2-logged-out-create-1280.png)・[768](evidence/epic-0002/ac2-logged-out-create-768.png)・[375](evidence/epic-0002/ac2-logged-out-create-375.png)、[誤りのパスワード 1280](evidence/epic-0002/ac2-login-wrong-1280.png)・[768](evidence/epic-0002/ac2-login-wrong-768.png)・[375](evidence/epic-0002/ac2-login-wrong-375.png)、[再ログイン後 1280](evidence/epic-0002/ac2-relogin-home-1280.png)・[768](evidence/epic-0002/ac2-relogin-home-768.png)・[375](evidence/epic-0002/ac2-relogin-home-375.png) |
| AC-3 | 分の境目の直後（秒が 4 未満）から、専用の `cf-connecting-ip` で、登録済みのメールに間違ったパスワードを 6 回送る。同じ手順で、未登録のメールも | PASS。登録済み（13:45:00〜13:45:03 UTC）も未登録（13:46:00〜13:46:03 UTC）も、1〜5 回目は「メールアドレスまたはパスワードが違います」、6 回目は「操作が多すぎます。しばらくしてからもう一度お試しください」。文言は 2 つの場合で同じ。窓の跨ぎは無い | [登録済み 5 回目 1280](evidence/epic-0002/ac3-registered-attempt5-1280.png)・[768](evidence/epic-0002/ac3-registered-attempt5-768.png)・[375](evidence/epic-0002/ac3-registered-attempt5-375.png)、[6 回目 1280](evidence/epic-0002/ac3-registered-attempt6-1280.png)・[768](evidence/epic-0002/ac3-registered-attempt6-768.png)・[375](evidence/epic-0002/ac3-registered-attempt6-375.png)、[未登録 5 回目 1280](evidence/epic-0002/ac3-unregistered-attempt5-1280.png)・[768](evidence/epic-0002/ac3-unregistered-attempt5-768.png)・[375](evidence/epic-0002/ac3-unregistered-attempt5-375.png)、[6 回目 1280](evidence/epic-0002/ac3-unregistered-attempt6-1280.png)・[768](evidence/epic-0002/ac3-unregistered-attempt6-768.png)・[375](evidence/epic-0002/ac3-unregistered-attempt6-375.png) |
| AC-4 | サインアップ直後に `context.cookies()` で属性を読む（値は記録しない） | PASS（Director の判定）。`HttpOnly`・`SameSite=Lax`・30 日は実ブラウザで確かめた。`Secure` と `__Secure-` は https のときだけ（ADR-0030）で、結合テストで確かめた。下の「AC-4 の事実」と「AC-4 の判定」を参照 | [Cookie の属性の表 1280](evidence/epic-0002/ac4-cookie-attrs-1280.png)（DevTools の Application の画面ではなく、`context.cookies()` の値を表にして撮った写真） |
| AC-5 | サインアップ・ログイン・ログアウト確認の 3 画面を、375px と 1280px で、Tab・文字入力・Enter だけで操作した | PASS。3 画面とも 375・1280px で最後まで操作できた（サインアップ → `/`、ログアウト確認 → `/accounts/login`、ログイン → `/`）。Tab の順は下に記す。どの幅も横のスクロールは無い。コンソールのエラー・警告と失敗した通信は全体で 0 | [サインアップ 1280](evidence/epic-0002/ac5-signup-keyboard-1280.png)・[375](evidence/epic-0002/ac5-signup-keyboard-375.png)、[ログアウト確認 1280](evidence/epic-0002/ac5-logout-keyboard-1280.png)・[375](evidence/epic-0002/ac5-logout-keyboard-375.png)、[ログイン 1280](evidence/epic-0002/ac5-login-keyboard-1280.png)・[375](evidence/epic-0002/ac5-login-keyboard-375.png) |

### AC-4 の事実

- `http://localhost:3103` のサインアップ直後の Cookie は 1 つ: `better-auth.session_token`、`HttpOnly: true`、`Secure: false`、`SameSite: Lax`、`Path: /`、`Expires: 2026-12-21T13:44:40Z`（30 日）。`__Secure-` の接頭辞は無い。`document.cookie` からは見えない（HttpOnly が効いている）。
- `Secure` と `__Secure-` は、[ADR-0030](../adr/0030-better-auth-session-and-rate-limit-rules.md) のとおり `BETTER_AUTH_URL` が https のときだけ付く。ローカルは http のため付かない。
- https のときに付くことを確かめる既存のテスト:
  - `src/features/auth/api/sign-up.int.test.ts` › 「パスワードの平文を保存せず Cookie に HttpOnly Secure SameSite=Lax を付ける」（`__Secure-better-auth.session_token=` で始まり、`HttpOnly`・`Secure`・`SameSite=Lax`・`Max-Age=2592000`・`Path=/` を含む）
  - `src/features/auth/model/session-cookie.test.ts` › 「HttpOnly と SameSite=Lax と Max-Age と Path を付け secure のとき Secure を付ける」（secure のとき `Secure` が付き、false のとき付かない）
  - `src/features/auth/api/log-out.int.test.ts`（ログアウトの Set-Cookie が `__Secure-better-auth.session_token=; Max-Age=0; Path=/` で始まる）
  - 実ブラウザの https では確かめていない（ローカルに https が無い）。

### AC-5 の Tab の順（[summary.json](evidence/epic-0002/summary.json) の `keyboard`）

| 画面 | 1280px | 375px |
|---|---|---|
| サインアップ | 本文へ移動 → メールアドレス → ユーザー名 → 表示名 → パスワード → サインアップ（ボタン） | 同じ |
| ログアウト確認 | 本文へ移動 → ホーム・検索・投稿・通知・プロフィール（左のナビ）→ ログアウト（ボタン）→ 末尾 | 本文へ移動 → ログアウト（ボタン）→ ホーム・検索・投稿・通知・プロフィール（下のナビ）→ 末尾 |
| ログイン | 本文へ移動 → メールアドレス → パスワード → ログイン（ボタン）→ サインアップ（リンク）→ 先頭に戻る | 同じ |

### AC-4 の判定（Director、2026-11-21）

- AC-4 の文（「`HttpOnly`・`Secure`・`SameSite=Lax` が付く」）は、[ADR-0030](../adr/0030-better-auth-session-and-rate-limit-rules.md) の前に書かれた。ADR-0030 は、`Secure` と `__Secure-` の接頭辞を `BETTER_AUTH_URL` が https のときだけ付けると決めている。M1 はローカルの http で動かす（[ADR-0006](../adr/0006-first-milestone-runs-locally-on-docker-compose.md)）ので、http で `Secure` が付かないのは決定どおり。
- https のときに付くことは、`src/features/auth/api/sign-up.int.test.ts` › `パスワードの平文を保存せず Cookie に HttpOnly Secure SameSite=Lax を付ける`、`src/features/auth/model/session-cookie.test.ts` › `HttpOnly と SameSite=Lax と Max-Age と Path を付け secure のとき Secure を付ける`、`src/features/auth/api/log-out.int.test.ts` が確かめている（回帰の verify で全て通った）。
- よって AC-4 は PASS とする。本物の https で Chrome から確かめるのは、M2 のデプロイの PBI（#30）で行う。EPIC #2 の本文の AC-4 に、この読み方を日付つきで書いた。

## ブラウザの状態

全ての画面と手順を通して、コンソールのエラー・警告・`pageerror`・失敗した要求（`requestfailed`）・状態 400 以上の応答を数えた。結果は全て 0（[summary.json](evidence/epic-0002/summary.json) の `events` が空）。

| 画面 | コンソールのエラー・警告 | 失敗した要求 |
|---|---|---|
| サインアップ（空・不正な入力・成功・重複したユーザー名・重複したメール） | 0 | 0 |
| `/`（サインアップ直後・再ログイン後） | 0 | 0 |
| ログアウト確認 | 0 | 0 |
| ログイン（ログアウト後・誤りのパスワード・6 回の試行・`/`・`/create` からの移動） | 0 | 0 |
| キーボードだけの 3 画面（375・1280px） | 0 | 0 |

## 回帰

| 確認 | 終了コード |
|---|---|
| `PORT=3103 node scripts/verify.mjs`（スロット 3、アプリのサーバーを止めて実行。typecheck・lint・format・docs・unit・integration・build・e2e の 8 手順が全て OK、子 PBI の E2E `e2e/signup.spec.ts`・`e2e/login-logout.spec.ts` を含む）。[verify.txt](evidence/epic-0002/verify.txt) | 0 |

最初の実行は、試験用のスクリプトを worktree の `.tmp_epic2/` に置いたため lint で落ちた（`.tmp_*/` は git の管理外だが eslint の対象）。スクリプトを worktree の外へ移して再実行し、0 で終わった。製品のコードの問題ではない。

## 見つけた問題

なし。

補足（問題ではない）: AC-4 の `Secure` は、ローカルが http であることで付かない。決定どおりで、判定は上の「AC-4 の判定」。
