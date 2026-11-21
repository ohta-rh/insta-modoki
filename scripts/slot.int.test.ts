// Integration test: needs the shared compose stack (docker compose up -d --wait).
// It resets and drops two slots, so it must not run on slots other worktrees are using.
// Defaults to slots 0 and 4; override with SLOT_INT_A and SLOT_INT_B.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { deleteObject, listObjects, parseEnv, putObject } from "./slot.mjs";

const A = Number(process.env.SLOT_INT_A ?? 0);
const B = Number(process.env.SLOT_INT_B ?? 4);
const script = new URL("./slot.mjs", import.meta.url).pathname;
const dirs: Record<number, string> = {};

function slot(command: string, n: number) {
  const r = spawnSync("node", [script, command, String(n)], { cwd: dirs[n], encoding: "utf8" });
  assert.equal(r.status, 0, `${command} ${n} failed: ${r.stderr}`);
}
function cfg(n: number) {
  const env = parseEnv(readFileSync(join(dirs[n], ".dev.vars"), "utf8"));
  return { endpoint: env.S3_ENDPOINT, region: env.S3_REGION, accessKey: env.S3_ACCESS_KEY, secretKey: env.S3_SECRET_KEY, bucket: env.S3_BUCKET };
}
function seed(n: number) {
  mkdirSync(join(dirs[n], ".wrangler/state"), { recursive: true });
  writeFileSync(join(dirs[n], ".wrangler/state/row.txt"), `row of slot ${n}`);
}
const hasRow = (n: number) => existsSync(join(dirs[n], ".wrangler/state/row.txt"));

before(() => {
  const stack = execFileSync("docker", ["ps", "-q", "--filter", "label=com.docker.compose.project=insta-modoki", "--filter", "label=com.docker.compose.service=s3", "--filter", "health=healthy"], { encoding: "utf8" });
  assert.ok(stack.trim(), "the shared stack is not running (docker compose up -d --wait)");
  for (const n of [A, B]) dirs[n] = mkdtempSync(join(tmpdir(), `slot-int-${n}-`));
});
after(() => {
  for (const n of [A, B]) {
    spawnSync("node", [script, "drop", String(n)], { cwd: dirs[n] });
    rmSync(dirs[n], { recursive: true, force: true });
  }
});

test("slot 1 と 2 は別の DB とバケットを持つ", async () => {
  slot("prepare", A);
  slot("prepare", B);
  const a = cfg(A);
  const b = cfg(B);
  assert.notEqual(a.bucket, b.bucket);
  assert.equal(a.bucket, `insta-s${A}`);
  await putObject(a, "only-a.txt", "a");
  assert.deepEqual(await listObjects(a), ["only-a.txt"]);
  assert.deepEqual(await listObjects(b), []);
  await deleteObject(a, "only-a.txt");
});

test("prepare を 2 回流しても既存のデータが残る", async () => {
  slot("prepare", A);
  seed(A);
  await putObject(cfg(A), "keep.txt", "keep");
  const before = readFileSync(join(dirs[A], ".dev.vars"), "utf8");
  slot("prepare", A);
  assert.ok(hasRow(A));
  assert.deepEqual(await listObjects(cfg(A)), ["keep.txt"]);
  assert.equal(readFileSync(join(dirs[A], ".dev.vars"), "utf8"), before, "secrets are kept across prepare");
});

test("slot 1 を reset しても slot 2 のデータは残る", async () => {
  slot("prepare", A);
  slot("prepare", B);
  seed(A);
  seed(B);
  await putObject(cfg(A), "a.txt", "a");
  await putObject(cfg(B), "b.txt", "b");
  slot("reset", A);
  assert.ok(!hasRow(A));
  assert.deepEqual(await listObjects(cfg(A)), []);
  assert.ok(hasRow(B));
  assert.deepEqual(await listObjects(cfg(B)), ["b.txt"]);
});

test("drop は指定したスロットだけを消す", async () => {
  slot("prepare", A);
  slot("prepare", B);
  seed(A);
  seed(B);
  await putObject(cfg(A), "a.txt", "a");
  await putObject(cfg(B), "b.txt", "b");
  const a = cfg(A);
  slot("drop", B);
  assert.ok(!hasRow(B));
  await assert.rejects(() => listObjects(cfg(B)), /NoSuchBucket|404/);
  assert.ok(existsSync(join(dirs[B], ".dev.vars")), ".dev.vars is kept by drop");
  assert.ok(hasRow(A));
  assert.deepEqual(await listObjects(a), ["a.txt"]);
});
