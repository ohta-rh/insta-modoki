import { execFileSync } from 'node:child_process';

// The app's D1 is a SQLite file the app writes to. A second process writing to it made the app
// fail with SQLITE_BUSY (ADR-0041), so the test process never writes: it asks the app's own
// /e2e-harness/db route (named operations, E2E_HARNESS only) to do it. Reads may stay direct.
//
// The helpers in support/ are synchronous, so the request runs in a short-lived node process.
const SCRIPT = `
const [url, body] = process.argv.slice(1);
fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  .then(async (r) => {
    const text = await r.text();
    if (!r.ok) { console.error(r.status + ' ' + text); process.exit(1); }
    process.stdout.write(text);
  })
  .catch((e) => { console.error(String(e)); process.exit(1); });
`;

/** Runs one operation; returns its JSON answer (only `seedSession` answers with data, ADR-0069). */
export function harness<T = unknown>(operation: { op: string } & Record<string, unknown>): T {
  const url = `http://localhost:${process.env.PORT ?? 3100}/e2e-harness/db`;
  try {
    const out = execFileSync(process.execPath, ['-e', SCRIPT, url, JSON.stringify(operation)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    return JSON.parse(out.toString()) as T;
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`E2E ハーネスの ${operation.op} が失敗しました: ${stderr ?? String(error)}`, {
      cause: error,
    });
  }
}
