# Issue authoring — this repository's specifics (ADR-0004, ADR-0005, ADR-0015)

**The standard is global: load the `write-pbi` skill (`~/.claude/skills/write-pbi/SKILL.md`)
before any `gh issue create` / `gh issue edit` of planned work, and write every EPIC and PBI in
its template.** This file adds only what is specific to insta-modoki.

## Hierarchy and labels

- Filed top-down: **Milestone** (GitHub Milestone, description per the template below) →
  **EPIC** (label `epic`, assigned to the milestone) → **PBI** (label `pbi`, same milestone,
  GitHub sub-issue of its EPIC). No loose issues.
- Extra labels: `blocked` (needs something only the user holds: an account, a secret, a name
  approval), `optional` (may be skipped — proposal feature 16), `bug` (with `pbi`).
- Titles: `[EPIC] <outcome>` / `<what the user can do, or what stops happening>`.

## Design references every PBI uses

- `docs/architecture/data-model.md`, `routes.md`, `conventions.md` — 実装方針 cites their sections
  (table, operation name, error code, limit) instead of re-deciding them. A PBI that needs a
  change to them changes the document in the same PBI and says so in 実装方針.
- Touch sets are concrete paths under the slice layout (ADR-0014, `conventions.md`). Append-only
  shared files (`docs/log.md`, `docs/**/index.md`) are not counted; the Director resolves their
  rebase conflicts by keeping both entries. The same holds for one-line registrations in the
  DB schema entry point, row appends to the tables in `docs/architecture/*.md`, and one-line
  exports added to a slice's `index.ts`.
- Hot spots (serialize to one PBI per wave): `compose.yaml`, `src/shared/db/` schema entry point,
  `.github/workflows/`, `package.json` + lockfile, `src/shared/ui/` nav.
- Until #18 (stack) closes, framework-dependent details go under 未確定事項 bound to #18; the
  Director refines them before dispatch (write-pbi §6).
- Proposal feature numbers are written `機能 N`, never `#N`.

- Before the verify command exists (#19) and CI exists (#22), the DoD items about verify / CI
  are met by the checks the issue's own AC name (#18, #20 say so in their last AC).

## Milestone description (literal headings)

```markdown
## 目的
## EPIC
## 準備完了の定義（DoR）
- [ ] 目的と範囲・範囲外が書かれている
- [ ] EPIC が全て起票され、EPIC 間の依存関係が書かれている
## 受け入れ条件（AC）
- [ ] <observable end-state> — 確認方法: <…>
## 完了の定義（DoD）
- [ ] 全 EPIC が閉じている
- [ ] 受け入れ条件を `main` の最新 commit で確かめ、記録を docs に残した
```

## DoR / DoD (copy verbatim into every issue)

### PBI

```markdown
## 準備完了の定義（DoR）
- [ ] 根本原因が一文で、開ける根拠つきで書かれている
- [ ] ユーザーストーリーが「誰が・何を・なぜ」で書かれている
- [ ] 全ての AC が Given / When / Then で、確認方法（テストの名前かコマンド）がある
- [ ] 実装方針に、データ・入出力・エラー・上限が決まって書かれている
- [ ] 未確定事項が「なし」になっている
- [ ] blocked by の issue が全て閉じている
- [ ] 触るファイルが具体的なパスで、同じ Wave の他の PBI と重ならない
- [ ] 1 回の pbi-implementer の実行（1〜2 日）に収まる

## 完了の定義（DoD）
- [ ] 各 AC を、先に落ちるテストを書いてから実装した（TDD の記録あり）
- [ ] 全ての AC を、書いてある確認方法で 1 つずつ確かめた
- [ ] code-reviewer と security-reviewer の両方が APPROVE を返した
- [ ] 画面で観測できる AC の全部に E2E があり、通った
- [ ] verify（全ての確認）が `main` への rebase 後に 0 で終わった
- [ ] 決定があれば ADR を同じ commit で足し、`docs/architecture/` と docs が OKF v0.3 として妥当
- [ ] `main` に入って push され、issue に commit・確認結果を書いて閉じた
```

### EPIC

```markdown
## 準備完了の定義（DoR）
- [ ] 根本原因が根拠つきで書かれている
- [ ] EPIC の AC が利用者の視点の Given / When / Then で、総合試験で判定できる
- [ ] 子 PBI が全て起票され、依存グラフと Wave 表がある

## 完了の定義（DoD）
- [ ] 子 PBI が全て閉じている
- [ ] 実ブラウザ（Chrome）で総合試験を行い、結果が PASS だった
- [ ] 総合試験のレポートと画面の写真を `docs/test-reports/` に commit し、`main` に push した
- [ ] 関係する docs と ADR が更新されている
```
