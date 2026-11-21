---
type: ADR
title: "ADR-0041: E2E の準備の書き込みは、テストのプロセスから SQLite を直接書かず、アプリの /e2e-harness/db を通す"
description: "E2E のテストが、アプリが使っている D1 の SQLite のファイルへ別のプロセスから書くと、並列に走るアプリの書き込みが SQLITE_BUSY で失敗した。準備の書き込みは、E2E 専用の Route Handler が名前つきの操作として、Worker の D1 の束縛で行う。読み出しは直接のままにする。"
tags: [testing, e2e, d1, sqlite]
status: stable
---

# ADR-0041: E2E の準備の書き込みは、テストのプロセスから SQLite を直接書かず、アプリの /e2e-harness/db を通す

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: Director（委任された判断）。実装は #32 の実装者
- 関連: [ADR-0019](0019-d1-and-drizzle.md)、[ADR-0022](0022-testing-ui-and-package-management.md)、[ADR-0023](0023-slots-with-garage-and-d1-files.md)、#32

## 背景

E2E は `opennextjs-cloudflare preview` のアプリを起動し、そのアプリの D1 は `.wrangler/state` の下の SQLite のファイルである。E2E の補助（`e2e/support/db.ts`、`posts.ts`）は、テストのプロセスから同じファイルを `node:sqlite` で開き、利用者・投稿・回数制限の行を直接書いていた。

並列の E2E（`--repeat-each=8` で 4 ファイル）を流すと、アプリのサインアップが次の例外で失敗し、画面に「エラーが発生しました」が出た（2026-11-21、`signUpAction` の例外を一時的に画面へ出して確認）。

- `Error: D1_ERROR: database is locked: SQLITE_BUSY`
- `Failed query: insert into "rate_limits" ... on conflict ... do update ...`

テストのプロセスの書き込みがファイルを掴んでいる間、アプリの書き込みは待てずに失敗する。`busy_timeout` は読み取りから書き込みへ上がるトランザクションには効かない。同じ失敗の形は `e2e/support/auth.ts` のコメントにも残っている。240 回の実行のうち 2〜5 回が落ち、落ちるのは準備の書き込みを使う仕様と同時に走った別の仕様だった。

## 決定

- E2E のテストのプロセスは、アプリの D1 へ書かない。準備の書き込みは `POST /e2e-harness/db`（`src/app/e2e-harness/db/route.ts`）に頼み、Worker 自身の D1 の束縛で行う。
- 入力は JSON の名前つきの操作 1 つ（`seedUser`、`insertPost`、`follow`、`setPostCount`、`clearRateLimits`）で、Zod の `strictObject` で長さと件数を制限する。SQL は受け取らない。
- 条件は `/e2e-harness/upload` と同じ。`E2E_HARNESS === '1'`（`playwright.config.ts` の webServer だけが渡す）で、かつ `APP_ENV !== 'production'` のときだけ動き、それ以外は 404。単体テスト（`route.test.ts`）で確かめる。
- `e2e/support/` の補助の名前と呼び方は変えない。同期の呼び出しのまま、短命の node のプロセスで HTTP を呼ぶ（`e2e/support/harness.ts`）。読み出し（`userRow`、`postRows` など）は直接のままにする。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 今のまま、書き込みの再試行を足す | 変更が小さい | 失敗の原因（2 つの書き手）が残り、再試行の長さの当て推量になる |
| E2E 専用の Route Handler で書く（採用） | 書き手がアプリだけになり、原因が消える。操作が名前つきで検証できる | 専用のエンドポイントが 1 つ増え、条件の検査が要る |
| Server Action にする | Next.js の流儀 | 画面から呼べる形になり、E2E 専用のものが本番の部品に近づく |
| テストごとに別の D1 | 衝突しない | アプリの起動が 1 つなので成り立たない |

## 結果

- 並列に走る E2E でも、アプリの D1 への書き手がアプリだけになり、SQLITE_BUSY で落ちない。
- E2E の準備の書き込みは 1 回ごとに短い HTTP 呼び出し（node のプロセス 1 つ）が増える。
- 守ること: E2E のテストのプロセスから D1 へ書かない。新しい準備が要るときは `operations.ts` に名前つきの操作を足す。条件の検査を外さない。M2 以降の本番のビルドでは `E2E_HARNESS` を渡さないので 404 のままである。
