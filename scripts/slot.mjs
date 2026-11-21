#!/usr/bin/env node
// Prepare, reset or drop a worktree's slot on the shared compose stack (ADR-0008, ADR-0023).
//   node scripts/slot.mjs <prepare|reset|drop> <N>        N is 0..4 (0 = main checkout; app port 3100 + N)
// Exit codes: 0 success, 1 stack down or a command failed, 2 bad arguments.
// The DB is D1 (files in .wrangler/state of the current directory); the bucket lives in Garage.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const S3_ENDPOINT = process.env.SLOT_S3_ENDPOINT ?? "http://localhost:3910";
const S3_REGION = "auto";
const KEY_NAME = "insta-local";
const COMPOSE_PROJECT = "insta-modoki";
const STACK_DOWN =
  "共有のスタックが起動していません。Director が docker compose up -d --wait を実行してください";

export function slotNames(n) {
  const text = String(n);
  if (!/^[0-4]$/.test(text)) throw new Error("slot は 0〜4 の整数です");
  const i = Number(text);
  return { db: `insta_s${i}`, testDb: `insta_s${i}_test`, bucket: `insta-s${i}`, port: 3100 + i };
}

export function renderEnv(n, { accessKey, secretKey, authPepper, authSecret }) {
  const { bucket, port } = slotNames(n);
  return (
    [
      ["SLOT", n],
      ["PORT", port],
      ["BETTER_AUTH_URL", `http://localhost:${port}`],
      ["BETTER_AUTH_SECRET", authSecret],
      ["AUTH_PEPPER", authPepper],
      ["S3_ENDPOINT", S3_ENDPOINT],
      ["S3_REGION", S3_REGION],
      ["S3_BUCKET", bucket],
      ["S3_ACCESS_KEY", accessKey],
      ["S3_SECRET_KEY", secretKey],
      ["S3_PUBLIC_BASE_URL", `${S3_ENDPOINT}/${bucket}`],
      ["MEDIA_ORIGIN", new URL(S3_ENDPOINT).origin],
    ]
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
}

export function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

// --- Minimal S3 client (SigV4, path style) for emptying buckets and for tests ---

const hash = (s) => createHash("sha256").update(s).digest("hex");
const hmac = (k, s) => createHmac("sha256", k).update(s).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

async function s3Request({ endpoint, region, accessKey, secretKey, bucket }, method, key, query = {}, body = "") {
  const url = new URL(endpoint);
  const path = `/${bucket}${key ? `/${key.split("/").map(enc).join("/")}` : ""}`;
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k])}`)
    .join("&");
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = hash(body);
  const headers = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signed = Object.keys(headers).sort();
  const canonical = [method, path, canonicalQuery, signed.map((h) => `${h}:${headers[h]}\n`).join(""), signed.join(";"), payloadHash].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`;
  const res = await fetch(`${endpoint.replace(/\/$/, "")}${path}${canonicalQuery ? `?${canonicalQuery}` : ""}`, {
    method,
    headers: { ...headers, authorization },
    body: body === "" ? undefined : body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`S3 ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text;
}

export const putObject = (cfg, key, body) => s3Request(cfg, "PUT", key, {}, body);
export const deleteObject = (cfg, key) => s3Request(cfg, "DELETE", key);

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export async function listObjects(cfg) {
  const keys = [];
  let token;
  do {
    const xml = await s3Request(cfg, "GET", "", { "list-type": "2", ...(token ? { "continuation-token": token } : {}) });
    for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(unxml(m[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(/<NextContinuationToken>([^<]*)</.exec(xml)?.[1] ?? "") : undefined;
  } while (token);
  return keys;
}

async function emptyBucket(cfg) {
  for (const key of await listObjects(cfg)) await deleteObject(cfg, key);
}

// --- The command ---

function realExec(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error) : "") };
}

export async function run(argv, deps = {}) {
  const exec = deps.exec ?? realExec;
  const cwd = deps.cwd ?? process.cwd();
  const out = deps.stdout ?? ((s) => process.stdout.write(`${s}\n`));
  const err = deps.stderr ?? ((s) => process.stderr.write(`${s}\n`));
  const randomHex = deps.randomHex ?? (() => randomBytes(32).toString("hex"));

  const [command, slotArg] = argv;
  let names;
  try {
    if (!["prepare", "reset", "drop"].includes(command)) throw new Error("使い方: node scripts/slot.mjs <prepare|reset|drop> <N>");
    names = slotNames(slotArg);
  } catch (e) {
    err(e.message);
    return 2;
  }
  const n = Number(slotArg);

  const ps = exec("docker", [
    "ps", "-q",
    "--filter", `label=com.docker.compose.project=${COMPOSE_PROJECT}`,
    "--filter", "label=com.docker.compose.service=s3",
    "--filter", "health=healthy",
  ]);
  const container = ps.stdout.trim().split("\n")[0];
  if (ps.status !== 0 || !container) {
    err(STACK_DOWN);
    return 1;
  }

  const garage = (...args) => exec("docker", ["exec", container, "/garage", ...args]);
  const field = (text, label) => new RegExp(`^${label}:\\s+(\\S+)`, "m").exec(text)?.[1];
  const fail = (what, r) => {
    err(`${what} に失敗しました: ${(r.stderr || r.stdout).trim().split("\n").pop()}`);
    return 1;
  };

  // The single access key, created once.
  let info = garage("key", "info", KEY_NAME, "--show-secret");
  if (info.status !== 0) {
    const created = garage("key", "create", KEY_NAME);
    // A concurrent prepare on a fresh stack may have created it first: read it back once.
    info = created.status === 0 ? created : garage("key", "info", KEY_NAME, "--show-secret");
    if (info.status !== 0) return fail("鍵の作成", created);
  }
  const accessKey = field(info.stdout, "Key ID");
  const secretKey = field(info.stdout, "Secret key");
  if (!accessKey || !secretKey) return fail("鍵の読み取り", info);
  const cfg = { endpoint: S3_ENDPOINT, region: S3_REGION, accessKey, secretKey, bucket: names.bucket };

  const ensureBucket = () => {
    if (garage("bucket", "info", names.bucket).status !== 0) {
      const r = garage("bucket", "create", names.bucket);
      if (r.status !== 0) return r;
    }
    return garage("bucket", "allow", "--read", "--write", "--owner", names.bucket, "--key", KEY_NAME);
  };
  const state = join(cwd, ".wrangler", "state");
  const envFile = join(cwd, ".dev.vars");

  try {
    if (command === "drop") {
      if (garage("bucket", "info", names.bucket).status === 0) {
        const r = ensureBucket();
        if (r.status !== 0) return fail("バケットの許可", r);
        await emptyBucket(cfg);
        const d = garage("bucket", "delete", "--yes", names.bucket);
        if (d.status !== 0) return fail("バケットの削除", d);
      }
      rmSync(state, { recursive: true, force: true });
      out(`slot ${n} を削除しました（${names.bucket}、.wrangler/state）。.dev.vars は残しています`);
      return 0;
    }

    if (command === "reset") rmSync(state, { recursive: true, force: true });
    const b = ensureBucket();
    if (b.status !== 0) return fail("バケットの準備", b);
    if (command === "reset") await emptyBucket(cfg);

    const prev = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
    writeFileSync(
      envFile,
      renderEnv(n, {
        accessKey,
        secretKey,
        authPepper: prev.AUTH_PEPPER || randomHex(),
        authSecret: prev.BETTER_AUTH_SECRET || randomHex(),
      }),
      { mode: 0o600 },
    );
    chmodSync(envFile, 0o600); // mode only applies to a new file


    if (existsSync(join(cwd, "migrations"))) {
      const m = exec("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local"], { cwd });
      if (m.status !== 0) return fail("マイグレーション", m);
    }
    out(`slot ${n} を${command === "reset" ? "初期化" : "準備"}しました（${names.bucket}、PORT=${names.port}、.dev.vars）`);
    return 0;
  } catch (e) {
    err(`slot ${n} の ${command} に失敗しました: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
