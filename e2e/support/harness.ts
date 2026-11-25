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
  })
  .catch((e) => { console.error(String(e)); process.exit(1); });
`;

export function harness(operation: { op: string } & Record<string, unknown>): void {
  const url = `http://localhost:${process.env.PORT ?? 3100}/e2e-harness/db`;
  try {
    execFileSync(process.execPath, ['-e', SCRIPT, url, JSON.stringify(operation)], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 30_000,
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`E2E ハーネスの ${operation.op} が失敗しました: ${stderr ?? String(error)}`, {
      cause: error,
    });
  }
}
